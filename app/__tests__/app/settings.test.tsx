import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/settings';
import { ApiError, createClient } from '@/api/client';
import { syncDates } from '@/dates/sync';
import { DbProvider } from '@/db/DbProvider';
import { loadSettings, saveSettings } from '@/settings/store';
import { createTestDb } from '../../testing/testDb';

jest.mock('@/settings/store', () => ({ loadSettings: jest.fn(), saveSettings: jest.fn() }));
jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), createClient: jest.fn() }));
jest.mock('@/dates/sync', () => ({ syncDates: jest.fn().mockResolvedValue(undefined) }));

const mockLoad = loadSettings as jest.MockedFunction<typeof loadSettings>;
const mockSave = saveSettings as jest.MockedFunction<typeof saveSettings>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockSync = syncDates as jest.MockedFunction<typeof syncDates>;
const mockHealth = jest.fn();

async function renderScreen() {
  const db = await createTestDb();
  await render(
    <DbProvider db={db}>
      <SettingsScreen />
    </DbProvider>,
  );
  await screen.findByDisplayValue('https://lt.example.com');
  return db;
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockResolvedValue({
      baseUrl: 'https://lt.example.com',
      key: 'secret',
      reminderLeadDays: 7,
      reminderHour: 9,
      reminderMinute: 0,
    });
    mockSave.mockResolvedValue(undefined);
    mockSync.mockResolvedValue(undefined);
    mockCreateClient.mockReturnValue({ health: mockHealth } as unknown as ReturnType<typeof createClient>);
  });

  test('prefills the inputs and masks the key', async () => {
    await renderScreen();

    expect(screen.getByTestId('settings-url')).toHaveDisplayValue('https://lt.example.com');
    expect(screen.getByTestId('settings-lead-days')).toHaveDisplayValue('7');
    expect(screen.getByTestId('settings-reminder-time')).toHaveDisplayValue('09:00');
    expect(screen.getByTestId('settings-key').props.secureTextEntry).toBe(true);
  });

  test('saves the parsed values, syncs dates, and shows Saved', async () => {
    const db = await renderScreen();

    await fireEvent.changeText(screen.getByTestId('settings-url'), 'https://other.example.com');
    await fireEvent.changeText(screen.getByTestId('settings-lead-days'), '3');
    await fireEvent.press(screen.getByTestId('settings-save'));

    expect(await screen.findByText('Saved')).toBeOnTheScreen();
    expect(mockSave).toHaveBeenCalledWith({
      baseUrl: 'https://other.example.com',
      key: 'secret',
      reminderLeadDays: 3,
      reminderHour: 9,
      reminderMinute: 0,
    });
    expect(mockSync).toHaveBeenCalledWith(db);
  });

  test('rejects an invalid reminder time', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('settings-reminder-time'), '25:00');
    await fireEvent.press(screen.getByTestId('settings-save'));

    expect(await screen.findByText('reminder time is not valid')).toBeOnTheScreen();
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('shows the message when saving fails', async () => {
    mockSave.mockRejectedValue(new Error('URL must start with https:// or http://'));
    await renderScreen();

    await fireEvent.press(screen.getByTestId('settings-save'));

    expect(await screen.findByText('URL must start with https:// or http://')).toBeOnTheScreen();
  });

  test.each([
    ['success', () => mockHealth.mockResolvedValue({ status: 'ok' }), 'Connected'],
    ['unauthorized', () => mockHealth.mockRejectedValue(new ApiError('unauthorized', 401, 'bad key')), 'Wrong key'],
    [
      'unreachable',
      () => mockHealth.mockRejectedValue(new ApiError('unreachable', null, "can't reach backend")),
      "Can't reach backend",
    ],
    ['other', () => mockHealth.mockRejectedValue(new ApiError('upstream_failed', 502, 'x')), 'Backend error'],
  ])('test connection: %s', async (_name, arrange, want) => {
    arrange();
    await renderScreen();

    await fireEvent.press(screen.getByTestId('settings-test'));

    expect(await screen.findByTestId('settings-status')).toHaveTextContent(want);
  });

  test('test connection uses the unsaved input values', async () => {
    mockHealth.mockResolvedValue({ status: 'ok' });
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('settings-url'), 'https://typed.example.com');
    await fireEvent.changeText(screen.getByTestId('settings-key'), 'typed-key');
    await fireEvent.press(screen.getByTestId('settings-test'));

    await screen.findByText('Connected');
    expect(mockCreateClient).toHaveBeenCalledWith({ baseUrl: 'https://typed.example.com', key: 'typed-key' });
  });
});
