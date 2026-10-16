import type { CalendarDate } from '@/api/types';
import type { DateWithPerson } from '@/db/types';
import { reminderTitle } from '@/reminders/schedule';

export function toCalendarDates(dates: DateWithPerson[]): CalendarDate[] {
  return dates.map((date) => ({
    id: date.id,
    title: reminderTitle(date),
    month: date.month,
    day: date.day,
    year: date.year,
    recurring: date.recurring,
  }));
}
