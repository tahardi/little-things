process.env.TZ = 'America/New_York';

import { nextOccurrence, upcoming } from '@/dates/upcoming';
import type { DateWithPerson } from '@/db/types';

const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

let nextId = 1;
function date(month: number, day: number, displayName: string): DateWithPerson {
  return {
    id: nextId++,
    personId: 1,
    kind: 'birthday',
    label: 'Birthday',
    month,
    day,
    year: null,
    recurring: true,
    calendarEventId: null,
    displayName,
  };
}

describe('nextOccurrence', () => {
  test.each([
    [
      'later this year',
      { month: 12, day: 25, year: null, recurring: true },
      local(2026, 10, 1, 15),
      local(2026, 12, 25),
    ],
    ['today counts', { month: 10, day: 1, year: 1990, recurring: true }, local(2026, 10, 1, 23), local(2026, 10, 1)],
    ['rolls to next year', { month: 1, day: 5, year: null, recurring: true }, local(2026, 10, 1), local(2027, 1, 5)],
    [
      'Feb 29 in non-leap year',
      { month: 2, day: 29, year: null, recurring: true },
      local(2026, 10, 1),
      local(2027, 2, 28),
    ],
    ['Feb 29 in leap year', { month: 2, day: 29, year: null, recurring: true }, local(2027, 10, 1), local(2028, 2, 29)],
    ['one-time future', { month: 11, day: 2, year: 2026, recurring: false }, local(2026, 10, 1), local(2026, 11, 2)],
    [
      'one-time without year acts yearly',
      { month: 3, day: 1, year: null, recurring: false },
      local(2026, 10, 1),
      local(2027, 3, 1),
    ],
  ])('%s', (_name, d, today, want) => {
    expect(nextOccurrence(d, today)).toEqual(want);
  });

  test('one-time past date has no occurrence', () => {
    expect(nextOccurrence({ month: 9, day: 1, year: 2026, recurring: false }, local(2026, 10, 1))).toBeNull();
  });
});

describe('upcoming', () => {
  const now = local(2026, 10, 1, 20);

  test('keeps dates within 30 days in order', () => {
    const dates = [
      date(11, 1, 'Late Person'),
      date(10, 31, 'Margaret Lin'),
      date(10, 2, 'Sam Ortiz'),
      date(10, 1, 'Priya Nair'),
    ];
    dates[1].displayName = 'Maggie';

    const got = upcoming(dates, now);

    expect(got.map((i) => [i.date.displayName, i.daysAway])).toEqual([
      ['Priya Nair', 0],
      ['Sam Ortiz', 1],
      ['Maggie', 30],
    ]);
  });

  test('sorts same-day dates by display name', () => {
    const got = upcoming([date(10, 5, 'Zed Park'), date(10, 5, 'Ann Cole')], now);

    expect(got.map((i) => i.date.displayName)).toEqual(['Ann Cole', 'Zed Park']);
  });

  test('days 0 returns only today', () => {
    const got = upcoming([date(10, 1, 'Priya Nair'), date(10, 2, 'Sam Ortiz')], now, 0);

    expect(got.map((i) => i.date.displayName)).toEqual(['Priya Nair']);
  });

  test('counts whole days across the DST change', () => {
    const got = upcoming([date(11, 3, 'Priya Nair')], local(2026, 10, 30), 30);

    expect(got[0].daysAway).toBe(4);
  });
});
