import type { Db } from '@/db/db';
import { expoNotifications, rebuildReminders } from '@/reminders/notifications';
import { loadSettings } from '@/settings/store';

let running: Promise<void> = Promise.resolve();

async function run(db: Db): Promise<void> {
  try {
    const settings = await loadSettings();
    await rebuildReminders(
      db,
      { leadDays: settings.reminderLeadDays, hour: settings.reminderHour, minute: settings.reminderMinute },
      expoNotifications,
      new Date(),
    );
  } catch (err) {
    console.warn('syncing dates', err);
  }
}

export function syncDates(db: Db): Promise<void> {
  running = running.then(() => run(db));
  return running;
}
