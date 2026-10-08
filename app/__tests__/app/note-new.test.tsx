import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import NewNoteScreen from '@/app/note/new';
import { listOpenClips } from '@/db/clips';
import type { Db } from '@/db/db';
import { DbProvider } from '@/db/DbProvider';
import { persistClip } from '@/processing/audioFiles';
import { processIfReachable } from '@/processing/processAll';
import { loadSettings } from '@/settings/store';
import { createTestDb } from '../../testing/testDb';

const mockReplace = jest.fn();
const mockPlay = jest.fn();
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockRequestPermission = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  Stack: { Screen: () => null },
}));

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: mockStop,
    uri: 'file:///tmp/rec.m4a',
  }),
  useAudioPlayer: () => ({ play: mockPlay }),
  requestRecordingPermissionsAsync: () => mockRequestPermission(),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/processing/audioFiles', () => ({
  persistClip: jest.fn().mockReturnValue('file:///docs/clips/clip-1.m4a'),
}));

jest.mock('@/processing/processAll', () => ({
  processIfReachable: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/settings/store', () => ({
  loadSettings: jest.fn(),
}));

jest.mock('@/api/client', () => ({
  createClient: jest.fn().mockReturnValue({}),
}));

const completeSettings = {
  baseUrl: 'http://backend',
  key: 'secret',
  reminderLeadDays: 7,
  reminderHour: 9,
  reminderMinute: 0,
};

async function renderScreen(db: Db) {
  await render(
    <DbProvider db={db}>
      <NewNoteScreen />
    </DbProvider>,
  );
  await waitFor(() => expect(mockRequestPermission).toHaveBeenCalled());
}

async function recordAndStop() {
  await fireEvent.press(screen.getByTestId('record-button'));
  await waitFor(() => expect(screen.getByTestId('record-status')).toHaveTextContent('Recording…'));
  await fireEvent.press(screen.getByTestId('record-button'));
  await waitFor(() => expect(screen.getByTestId('record-status')).toHaveTextContent('Recorded'));
}

describe('NewNoteScreen', () => {
  let db: Db;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRequestPermission.mockResolvedValue({ granted: true });
    (loadSettings as jest.Mock).mockResolvedValue(completeSettings);
    (processIfReachable as jest.Mock).mockResolvedValue(null);
    (persistClip as jest.Mock).mockReturnValue('file:///docs/clips/clip-1.m4a');
    db = await createTestDb();
  });

  test('disables save and play before recording', async () => {
    await renderScreen(db);

    expect(screen.getByTestId('record-status')).toHaveTextContent('Ready');
    expect(screen.getByTestId('save-button')).toBeDisabled();
    expect(screen.getByTestId('play-button')).toBeDisabled();
  });

  test('saves a recorded clip to the queue and processes it', async () => {
    await renderScreen(db);
    await recordAndStop();

    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => expect(processIfReachable).toHaveBeenCalledTimes(1));
    expect(persistClip).toHaveBeenCalledWith('file:///tmp/rec.m4a', expect.any(Date));
    const clips = await listOpenClips(db);
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ status: 'queued', fileUri: 'file:///docs/clips/clip-1.m4a' });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  test('queues without processing when settings are incomplete', async () => {
    (loadSettings as jest.Mock).mockResolvedValue({ ...completeSettings, baseUrl: '' });
    await renderScreen(db);
    await recordAndStop();

    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(await listOpenClips(db)).toHaveLength(1);
    expect(processIfReachable).not.toHaveBeenCalled();
  });

  test('re-record returns to ready and disables save', async () => {
    await renderScreen(db);
    await recordAndStop();

    await fireEvent.press(screen.getByTestId('rerecord-button'));

    expect(screen.getByTestId('record-status')).toHaveTextContent('Ready');
    expect(screen.getByTestId('save-button')).toBeDisabled();
  });

  test('play plays the recording', async () => {
    await renderScreen(db);
    await recordAndStop();

    await fireEvent.press(screen.getByTestId('play-button'));

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  test('offers settings when microphone access is denied', async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderScreen(db);

    expect(await screen.findByTestId('mic-denied')).toHaveTextContent('Microphone access is off');
    await fireEvent.press(screen.getByTestId('open-mic-settings'));

    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});
