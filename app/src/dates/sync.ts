import { createClient } from '@/api/client';
import { secureCalendarStore, syncCalendar } from '@/calendar/sync';
import type { Db } from '@/db/db';
import { expoNotifications, rebuildReminders } from '@/reminders/notifications';
import { loadSettings } from '@/settings/store';

let running: Promise<void> = Promise.resolve();

async function run(db: Db): Promise<void> {
  let settings;
  try {
    settings = await loadSettings();
    await rebuildReminders(
      db,
      { leadDays: settings.reminderLeadDays, hour: settings.reminderHour, minute: settings.reminderMinute },
      expoNotifications,
      new Date(),
    );
  } catch (err) {
    console.warn('syncing reminders', err);
  }
  if (!settings) {
    return;
  }
  try {
    await syncCalendar(db, createClient({ baseUrl: settings.baseUrl, key: settings.key }), secureCalendarStore);
  } catch (err) {
    console.warn('syncing calendar', err);
  }
}

export function syncDates(db: Db): Promise<void> {
  running = running.then(() => run(db));
  return running;
}
