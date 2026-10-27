import * as Notifications from 'expo-notifications';

import { listAllDates } from '@/db/dates';
import type { Db } from '@/db/db';
import { computeReminders, type Reminder, type ReminderSettings } from '@/reminders/schedule';

export type NotificationsApi = {
  isGranted(): Promise<boolean>;
  request(): Promise<boolean>;
  cancelAll(): Promise<void>;
  schedule(reminder: Reminder): Promise<void>;
};

export const expoNotifications: NotificationsApi = {
  isGranted: async () => (await Notifications.getPermissionsAsync()).granted,
  request: async () => (await Notifications.requestPermissionsAsync()).granted,
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
  schedule: async (reminder) => {
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.title, body: reminder.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt },
    });
  },
};

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function rebuildReminders(
  db: Db,
  settings: ReminderSettings,
  api: NotificationsApi,
  now: Date,
): Promise<boolean> {
  const reminders = computeReminders(await listAllDates(db), now, settings);
  if (reminders.length === 0) {
    await api.cancelAll();
    return true;
  }
  const granted = (await api.isGranted()) || (await api.request());
  if (!granted) {
    return false;
  }
  await api.cancelAll();
  for (const reminder of reminders) {
    await api.schedule(reminder);
  }
  return true;
}
