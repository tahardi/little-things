import type { Db } from '@/db/db';
import { syncDates } from '@/dates/sync';
import { rebuildReminders } from '@/reminders/notifications';

jest.mock('@/settings/store', () => ({
  loadSettings: async () => ({ baseUrl: '', key: '', reminderLeadDays: 3, reminderHour: 8, reminderMinute: 15 }),
}));
jest.mock('@/reminders/notifications', () => ({ expoNotifications: {}, rebuildReminders: jest.fn() }));

const rebuild = rebuildReminders as jest.MockedFunction<typeof rebuildReminders>;
const db = {} as Db;

describe('syncDates', () => {
  beforeEach(() => rebuild.mockReset());

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
});
