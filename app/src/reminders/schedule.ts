import { nextOccurrence } from '@/dates/upcoming';
import type { DateWithPerson } from '@/db/types';

export type ReminderSettings = { leadDays: number; hour: number; minute: number };
export type Reminder = { fireAt: Date; title: string; body: string };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function atTime(day: Date, daysBefore: number, settings: ReminderSettings): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - daysBefore, settings.hour, settings.minute);
}

function reminderDay(date: DateWithPerson, now: Date, settings: ReminderSettings): Date | null {
  const on = nextOccurrence(date, now);
  if (on === null || atTime(on, 0, settings) > now) {
    return on;
  }
  return nextOccurrence(date, new Date(on.getFullYear(), on.getMonth(), on.getDate() + 1));
}

export function reminderTitle(date: DateWithPerson): string {
  return date.kind === 'birthday' ? `${date.displayName}'s birthday` : `${date.displayName}: ${date.label}`;
}

export function computeReminders(
  dates: DateWithPerson[],
  now: Date,
  settings: ReminderSettings,
  limit = 64,
): Reminder[] {
  const reminders: Reminder[] = [];
  for (const date of dates) {
    const day = reminderDay(date, now, settings);
    if (day === null) {
      continue;
    }
    const title = reminderTitle(date);
    const onDay = atTime(day, 0, settings);
    const when = `${MONTHS[onDay.getMonth()]} ${onDay.getDate()}`;
    if (settings.leadDays > 0) {
      const lead = atTime(day, settings.leadDays, settings);
      if (lead > now) {
        const unit = settings.leadDays === 1 ? 'day' : 'days';
        reminders.push({ fireAt: lead, title, body: `In ${settings.leadDays} ${unit}, on ${when}.` });
      }
    }
    reminders.push({ fireAt: onDay, title, body: `Today, ${when}.` });
  }
  return reminders
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.title.localeCompare(b.title))
    .slice(0, limit);
}
