import * as SecureStore from 'expo-secure-store';

import { ApiError, type Client } from '@/api/client';
import { toCalendarDates } from '@/calendar/payload';
import { listAllDates } from '@/db/dates';
import type { Db } from '@/db/db';

export type CalendarSyncStatus = 'ok' | 'pending' | 'not_configured';
export type CalendarSyncState = { pending: boolean; status: CalendarSyncStatus; lastSyncedAt: string | null };
export type CalendarSyncStore = {
  load(): Promise<CalendarSyncState>;
  save(state: CalendarSyncState): Promise<void>;
};

export const INITIAL_CALENDAR_STATE: CalendarSyncState = { pending: false, status: 'ok', lastSyncedAt: null };

const KEY = 'calendarSync';

export const secureCalendarStore: CalendarSyncStore = {
  load: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      return raw ? { ...INITIAL_CALENDAR_STATE, ...JSON.parse(raw) } : { ...INITIAL_CALENDAR_STATE };
    } catch {
      return { ...INITIAL_CALENDAR_STATE };
    }
  },
  save: (state) => SecureStore.setItemAsync(KEY, JSON.stringify(state)),
};

export async function syncCalendar(
  db: Db,
  client: Pick<Client, 'calendar'>,
  store: CalendarSyncStore,
  now = new Date(),
): Promise<CalendarSyncState> {
  const dates = toCalendarDates(await listAllDates(db));
  const previous = await store.load();
  let next: CalendarSyncState;
  try {
    await client.calendar(dates);
    next = { pending: false, status: 'ok', lastSyncedAt: now.toISOString() };
  } catch (err) {
    const notConfigured = err instanceof ApiError && err.code === 'calendar_not_configured';
    next = { pending: true, status: notConfigured ? 'not_configured' : 'pending', lastSyncedAt: previous.lastSyncedAt };
  }
  await store.save(next);
  return next;
}
