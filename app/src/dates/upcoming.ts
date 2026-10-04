import type { DateWithPerson } from '@/db/types';

export type DateLike = { month: number; day: number; year: number | null; recurring: boolean };
export type UpcomingItem = { date: DateWithPerson; on: Date; daysAway: number };

const DAY_MS = 86_400_000;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function onYear(d: DateLike, year: number): Date {
  const day = d.month === 2 && d.day === 29 && !isLeap(year) ? 28 : d.day;
  return new Date(year, d.month - 1, day);
}

function startOfDay(t: Date): Date {
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function nextOccurrence(d: DateLike, today: Date): Date | null {
  const start = startOfDay(today);
  if (!d.recurring && d.year !== null) {
    const once = onYear(d, d.year);
    return once < start ? null : once;
  }
  const thisYear = onYear(d, start.getFullYear());
  return thisYear < start ? onYear(d, start.getFullYear() + 1) : thisYear;
}

export function upcoming(dates: DateWithPerson[], now: Date, days = 30): UpcomingItem[] {
  const start = startOfDay(now);
  const items: UpcomingItem[] = [];
  for (const date of dates) {
    const on = nextOccurrence(date, now);
    if (!on) {
      continue;
    }
    const daysAway = Math.round((on.getTime() - start.getTime()) / DAY_MS);
    if (daysAway <= days) {
      items.push({ date, on, daysAway });
    }
  }
  return items.sort((a, b) => a.daysAway - b.daysAway || a.date.displayName.localeCompare(b.date.displayName));
}
