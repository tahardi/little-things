import type { Db } from '@/db/db';
import { createPerson } from '@/db/people';
import { type NotificationsApi, rebuildReminders } from '@/reminders/notifications';
import type { Reminder } from '@/reminders/schedule';

import { createTestDb } from '../../testing/testDb';

jest.mock('expo-notifications', () => ({}));

const settings = { leadDays: 7, hour: 9, minute: 0 };
const now = new Date(2026, 8, 29, 10, 0);

function fakeApi(granted: boolean, grantOnRequest: boolean) {
  const pending: Reminder[] = [];
  const calls: string[] = [];
  const api: NotificationsApi = {
    isGranted: async () => granted,
    request: async () => {
      calls.push('request');
      return grantOnRequest;
    },
    cancelAll: async () => {
      calls.push('cancelAll');
      pending.length = 0;
    },
    schedule: async (reminder) => {
      calls.push('schedule');
      pending.push(reminder);
    },
  };
  return { api, pending, calls };
}

async function seed(): Promise<Db> {
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

describe('rebuildReminders', () => {
  it('cancels then schedules the computed reminders when granted', async () => {
    const db = await seed();
    const { api, pending, calls } = fakeApi(true, false);

    const got = await rebuildReminders(db, settings, api, now);

    expect(got).toBe(true);
    expect(calls).toEqual(['cancelAll', 'schedule', 'schedule']);
    expect(pending.map((r) => r.title)).toEqual(["Maggie's birthday", "Maggie's birthday"]);
  });

  it('asks for permission when not yet granted', async () => {
    const db = await seed();
    const { api, pending, calls } = fakeApi(false, true);

    const got = await rebuildReminders(db, settings, api, now);

    expect(got).toBe(true);
    expect(calls[0]).toBe('request');
    expect(pending).toHaveLength(2);
  });

  it('schedules nothing when permission is denied', async () => {
    const db = await seed();
    const { api, calls } = fakeApi(false, false);

    const got = await rebuildReminders(db, settings, api, now);

    expect(got).toBe(false);
    expect(calls).toEqual(['request']);
  });

  it('does not ask for permission when there is nothing to remind', async () => {
    const db = await createTestDb();
    const { api, calls } = fakeApi(false, true);

    const got = await rebuildReminders(db, settings, api, now);

    expect(got).toBe(true);
    expect(calls).toEqual(['cancelAll']);
  });

  it('does not duplicate reminders when rebuilt twice', async () => {
    const db = await seed();
    const { api, pending } = fakeApi(true, false);

    await rebuildReminders(db, settings, api, now);
    await rebuildReminders(db, settings, api, now);

    expect(pending).toHaveLength(2);
  });
});
