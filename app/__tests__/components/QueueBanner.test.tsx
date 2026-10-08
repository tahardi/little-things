process.env.TZ = 'America/New_York';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { NoteResponse } from '@/api/types';
import { QueueBanner } from '@/components/QueueBanner';
import { claimNextQueued, createClip, markClipError, markClipReview } from '@/db/clips';
import type { Db } from '@/db/db';
import { DbProvider } from '@/db/DbProvider';
import { currentRun, processAll } from '@/processing/processAll';
import { loadSettings } from '@/settings/store';
import { createTestDb } from '../../testing/testDb';

const mockPush = jest.fn();
const mockHealth = jest.fn();

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock('@/settings/store', () => ({
  loadSettings: jest.fn(),
}));

jest.mock('@/api/client', () => ({
  createClient: () => ({ health: () => mockHealth() }),
}));

jest.mock('@/processing/processAll', () => ({
  processAll: jest.fn(),
  currentRun: jest.fn(),
}));

const now = new Date('2026-09-29T16:00:00Z');

const completeSettings = {
  baseUrl: 'http://backend',
  key: 'secret',
  reminderLeadDays: 7,
  reminderHour: 9,
  reminderMinute: 0,
};

const result: NoteResponse = { transcript: 't', matches: [], unknown: [], notes: '' };

async function renderBanner(db: Db) {
  await render(
    <DbProvider db={db}>
      <QueueBanner />
    </DbProvider>,
  );
}

describe('QueueBanner', () => {
  let db: Db;

  beforeEach(async () => {
    jest.clearAllMocks();
    (loadSettings as jest.Mock).mockResolvedValue(completeSettings);
    (currentRun as jest.Mock).mockReturnValue(null);
    mockHealth.mockResolvedValue({ status: 'ok' });
    db = await createTestDb();
  });

  test('renders nothing with no open clips', async () => {
    await renderBanner(db);

    await waitFor(() => expect(loadSettings).toHaveBeenCalled());
    expect(screen.queryByTestId('process-all')).toBeNull();
  });

  test('shows a queued clip with its stored error', async () => {
    const id = await createClip(db, 'file:///a.m4a', now);
    await claimNextQueued(db);
    await markClipError(db, id, "Can't reach backend");
    await renderBanner(db);

    expect(await screen.findByTestId(`clip-${id}`)).toHaveTextContent(/Waiting to process/);
    expect(screen.getByTestId(`clip-error-${id}`)).toHaveTextContent("Can't reach backend");
  });

  test('shows a review clip and opens it', async () => {
    const id = await createClip(db, 'file:///a.m4a', now);
    await claimNextQueued(db);
    await markClipReview(db, id, result);
    await renderBanner(db);

    expect(await screen.findByTestId(`clip-${id}`)).toHaveTextContent(/Ready to review/);
    await fireEvent.press(screen.getByTestId(`review-${id}`));

    expect(mockPush).toHaveBeenCalledWith(`/review/${id}`);
  });

  test('processes every queued clip and reloads', async () => {
    const a = await createClip(db, 'file:///a.m4a', now);
    const b = await createClip(db, 'file:///b.m4a', now);
    (processAll as jest.Mock).mockImplementation(async () => {
      for (const id of [a, b]) {
        await claimNextQueued(db);
        await markClipReview(db, id, result);
      }
      return { processed: 2, failed: 0 };
    });
    await renderBanner(db);
    const button = await screen.findByTestId('process-all');
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveTextContent('Process 2 notes');

    await fireEvent.press(button);

    await waitFor(() => expect(screen.getByTestId(`clip-${a}`)).toHaveTextContent(/Ready to review/));
    expect(screen.getByTestId(`clip-${b}`)).toHaveTextContent(/Ready to review/);
    expect(processAll).toHaveBeenCalledTimes(1);
  });

  test('disables process-all when health fails', async () => {
    await createClip(db, 'file:///a.m4a', now);
    mockHealth.mockRejectedValue(new Error('down'));
    await renderBanner(db);

    const button = await screen.findByTestId('process-all');

    await waitFor(() => expect(mockHealth).toHaveBeenCalled());
    expect(button).toBeDisabled();
  });

  test('shows a setup hint when settings are incomplete', async () => {
    await createClip(db, 'file:///a.m4a', now);
    (loadSettings as jest.Mock).mockResolvedValue({ ...completeSettings, key: '' });
    await renderBanner(db);

    expect(await screen.findByTestId('queue-setup-hint')).toHaveTextContent('Set up the backend in Settings');
    expect(mockHealth).not.toHaveBeenCalled();
  });

  test('waits for a run in flight and then reloads', async () => {
    const id = await createClip(db, 'file:///a.m4a', now);
    await claimNextQueued(db);
    let finish: (value: { processed: number; failed: number }) => void = () => {};
    const pending = new Promise<{ processed: number; failed: number }>((resolve) => {
      finish = resolve;
    });
    (currentRun as jest.Mock).mockReturnValue(pending);
    await renderBanner(db);

    expect(await screen.findByTestId(`clip-${id}`)).toHaveTextContent(/Processing…/);
    expect(screen.getByTestId('process-all')).toBeDisabled();

    (currentRun as jest.Mock).mockReturnValue(null);
    await markClipReview(db, id, result);
    finish({ processed: 1, failed: 0 });

    await waitFor(() => expect(screen.getByTestId(`clip-${id}`)).toHaveTextContent(/Ready to review/));
  });
});
