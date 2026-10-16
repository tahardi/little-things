import type { Db } from '@/db/db';
import { syncDates } from '@/dates/sync';
import { syncCalendar } from '@/calendar/sync';
import { rebuildReminders } from '@/reminders/notifications';

jest.mock('@/settings/store', () => ({
  loadSettings: async () => ({
    baseUrl: 'https://pc.ts.net',
    key: 'k',
    reminderLeadDays: 3,
    reminderHour: 8,
    reminderMinute: 15,
  }),
}));
jest.mock('@/reminders/notifications', () => ({ expoNotifications: {}, rebuildReminders: jest.fn() }));
jest.mock('@/calendar/sync', () => ({ secureCalendarStore: {}, syncCalendar: jest.fn() }));
jest.mock('@/api/client', () => ({ createClient: jest.fn((config) => ({ config })) }));

const rebuild = rebuildReminders as jest.MockedFunction<typeof rebuildReminders>;
const calendar = syncCalendar as jest.MockedFunction<typeof syncCalendar>;
const db = {} as Db;

describe('syncDates', () => {
  beforeEach(() => {
    rebuild.mockReset();
    calendar.mockReset();
  });

  it('rebuilds reminders with the saved reminder settings', async () => {
    rebuild.mockResolvedValue(true);

    await syncDates(db);

    expect(rebuild).toHaveBeenCalledWith(db, { leadDays: 3, hour: 8, minute: 15 }, {}, expect.any(Date));
  });

  it('runs one rebuild at a time', async () => {
    let active = 0;
    let maxActive = 0;
    rebuild.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return true;
    });

    await Promise.all([syncDates(db), syncDates(db), syncDates(db)]);

    expect(rebuild).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });

  it('does not throw when a rebuild fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    rebuild.mockRejectedValue(new Error('boom'));

    await expect(syncDates(db)).resolves.toBeUndefined();
    await expect(syncDates(db)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('syncs the calendar after reminders using the saved backend settings', async () => {
    const order: string[] = [];
    rebuild.mockImplementation(async () => {
      order.push('reminders');
      return true;
    });
    calendar.mockImplementation(async () => {
      order.push('calendar');
      return { pending: false, status: 'ok', lastSyncedAt: null };
    });

    await syncDates(db);

    expect(order).toEqual(['reminders', 'calendar']);
    expect(calendar).toHaveBeenCalledWith(db, { config: { baseUrl: 'https://pc.ts.net', key: 'k' } }, {});
  });

  it('still syncs the calendar when reminders fail', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    rebuild.mockRejectedValue(new Error('boom'));

    await syncDates(db);

    expect(calendar).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not throw when the calendar sync fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    rebuild.mockResolvedValue(true);
    calendar.mockRejectedValue(new Error('store broke'));

    await expect(syncDates(db)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
