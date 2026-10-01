import * as SecureStore from 'expo-secure-store';

export type Settings = {
  baseUrl: string;
  key: string;
  reminderLeadDays: number;
  reminderHour: number;
  reminderMinute: number;
};

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  key: '',
  reminderLeadDays: 7,
  reminderHour: 9,
  reminderMinute: 0,
};

const STORE_KEY = 'settings';

function isIntIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export async function loadSettings(): Promise<Settings> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const next = { ...settings, baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''), key: settings.key.trim() };
  if (next.baseUrl !== '' && !/^https?:\/\//.test(next.baseUrl)) {
    throw new Error('URL must start with https:// or http://');
  }
  if (!isIntIn(next.reminderLeadDays, 0, 60)) {
    throw new Error('lead days must be a whole number from 0 to 60');
  }
  if (!isIntIn(next.reminderHour, 0, 23) || !isIntIn(next.reminderMinute, 0, 59)) {
    throw new Error('reminder time is not valid');
  }
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
}
