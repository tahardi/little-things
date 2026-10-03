import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/settings/store';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  }),
}));

describe('settings store', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('loadSettings - returns defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      baseUrl: '',
      key: '',
      reminderLeadDays: 7,
      reminderHour: 9,
      reminderMinute: 0,
    });
  });

  it('saveSettings - trims and round-trips', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, baseUrl: ' https://pc.ts.net/ ', key: ' k ' });

    const got = await loadSettings();

    expect(got.baseUrl).toBe('https://pc.ts.net');
    expect(got.key).toBe('k');
  });

  it('loadSettings - returns defaults for unparseable data', async () => {
    mockStore.set('settings', 'not json');

    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('loadSettings - merges stored data over defaults', async () => {
    mockStore.set('settings', JSON.stringify({ baseUrl: 'https://x' }));

    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, baseUrl: 'https://x' });
  });

  it('loadSettings - returns a copy of the defaults', async () => {
    const got = await loadSettings();
    got.reminderHour = 1;

    expect(DEFAULT_SETTINGS.reminderHour).toBe(9);
  });

  it.each([
    [{ baseUrl: 'ftp://x' }, 'URL must start with https:// or http://'],
    [{ reminderLeadDays: -1 }, 'lead days must be a whole number from 0 to 60'],
    [{ reminderLeadDays: 61 }, 'lead days must be a whole number from 0 to 60'],
    [{ reminderLeadDays: 1.5 }, 'lead days must be a whole number from 0 to 60'],
    [{ reminderHour: 24 }, 'reminder time is not valid'],
    [{ reminderMinute: 60 }, 'reminder time is not valid'],
  ])('saveSettings - rejects %j', async (patch, message) => {
    await expect(saveSettings({ ...DEFAULT_SETTINGS, ...patch })).rejects.toThrow(message);

    expect(mockStore.size).toBe(0);
  });

  it('saveSettings - allows an empty URL', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, baseUrl: '' });

    expect(mockStore.size).toBe(1);
  });
});
