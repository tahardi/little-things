import { ApiError, type Client } from '@/api/client';
import type { CalendarDate } from '@/api/types';
import {
  type CalendarSyncState,
  type CalendarSyncStore,
  INITIAL_CALENDAR_STATE,
  secureCalendarStore,
  syncCalendar,
} from '@/calendar/sync';
import type { Db } from '@/db/db';
import { createPerson } from '@/db/people';

import { createTestDb } from '../../testing/testDb';

const mockSecure = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockSecure.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockSecure.set(k, v);
    return Promise.resolve();
  }),
}));

const now = new Date('2026-09-29T14:00:00.000Z');
const earlier = '2026-09-01T09:00:00.000Z';

function memoryStore(initial: CalendarSyncState = INITIAL_CALENDAR_STATE) {
  let state = initial;
  const store: CalendarSyncStore = {
    load: async () => state,
    save: async (next) => {
      state = next;
    },
  };
  return { store, current: () => state };
}

function fakeClient(result: () => Promise<unknown>) {
  const sent: CalendarDate[][] = [];
  const client: Pick<Client, 'calendar'> = {
    calendar: async (dates) => {
      sent.push(dates);
      return (await result()) as never;
    },
  };
  return { client, sent };
}

async function dbWithBirthday(): Promise<Db> {
  const db = await createTestDb();
  await createPerson(
    db,
    {
      name: 'Margaret Lin',
      preferredName: 'Maggie',
      nicknames: [],
      relationship: null,
      birthday: { month: 10, day: 11, year: null },
      address: null,
      phone: null,
      interests: [],
      notes: [],
    },
    now,
  );
  return db;
}

const ok = () => Promise.resolve({ created: 1, updated: 0, deleted: 0 });

describe('syncCalendar', () => {
  it('sends every date and records a successful sync', async () => {
    const db = await dbWithBirthday();
    const { client, sent } = fakeClient(ok);
    const { store, current } = memoryStore({ pending: true, status: 'pending', lastSyncedAt: earlier });

    const got = await syncCalendar(db, client, store, now);

    expect(sent).toEqual([[expect.objectContaining({ title: "Maggie's birthday", month: 10, day: 11 })]]);
    expect(got).toEqual({ pending: false, status: 'ok', lastSyncedAt: '2026-09-29T14:00:00.000Z' });
    expect(current()).toEqual(got);
  });

  it('sends an empty list so the backend removes deleted dates', async () => {
    const { client, sent } = fakeClient(ok);

    await syncCalendar(await createTestDb(), client, memoryStore().store, now);

    expect(sent).toEqual([[]]);
  });

  test.each([
    ['backend unreachable', new ApiError('unreachable', null, "can't reach backend"), 'pending'],
    ['backend error', new ApiError('upstream_failed', 502, 'boom'), 'pending'],
    ['unexpected error', new Error('boom'), 'pending'],
    ['calendar not configured', new ApiError('calendar_not_configured', 503, 'not configured'), 'not_configured'],
  ])('%s marks the sync pending', async (_name, error, status) => {
    const db = await dbWithBirthday();
    const { client } = fakeClient(() => Promise.reject(error));
    const { store, current } = memoryStore({ pending: false, status: 'ok', lastSyncedAt: earlier });

    const got = await syncCalendar(db, client, store, now);

    expect(got).toEqual({ pending: true, status, lastSyncedAt: earlier });
    expect(current()).toEqual(got);
  });

  it('clears a pending sync on the next success', async () => {
    const db = await dbWithBirthday();
    const { store, current } = memoryStore();

    await syncCalendar(db, fakeClient(() => Promise.reject(new Error('down'))).client, store, now);
    await syncCalendar(db, fakeClient(ok).client, store, now);

    expect(current().pending).toBe(false);
    expect(current().status).toBe('ok');
  });
});

describe('secureCalendarStore', () => {
  beforeEach(() => mockSecure.clear());

  it('loads the initial state when nothing is stored', async () => {
    expect(await secureCalendarStore.load()).toEqual(INITIAL_CALENDAR_STATE);
  });

  it('round-trips a state under the calendarSync key', async () => {
    const state: CalendarSyncState = { pending: true, status: 'not_configured', lastSyncedAt: earlier };

    await secureCalendarStore.save(state);

    expect(JSON.parse(mockSecure.get('calendarSync') ?? '')).toEqual(state);
    expect(await secureCalendarStore.load()).toEqual(state);
  });

  it('loads the initial state when the stored value is not json', async () => {
    mockSecure.set('calendarSync', 'not json');

    expect(await secureCalendarStore.load()).toEqual(INITIAL_CALENDAR_STATE);
  });
});
