process.env.TZ = 'America/New_York';

import type { DateWithPerson } from '@/db/types';
import { computeReminders, reminderTitle } from '@/reminders/schedule';

const settings = { leadDays: 7, hour: 9, minute: 0 };

function date(overrides: Partial<DateWithPerson> = {}): DateWithPerson {
  return {
    id: 1,
    personId: 1,
    kind: 'birthday',
    label: 'Birthday',
    month: 10,
    day: 11,
    year: null,
    recurring: true,
    calendarEventId: null,
    displayName: 'Maggie',
    ...overrides,
  };
}

function at(year: number, month: number, day: number, hour = 9, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

const surgery = { kind: 'other' as const, label: 'Surgery', month: 11, day: 2, recurring: false };

describe('computeReminders', () => {
  test.each([
    ['upcoming yearly date gets lead and day-of', date(), at(2026, 9, 29, 10), [at(2026, 10, 4), at(2026, 10, 11)]],
    ['lead alert already past', date(), at(2026, 10, 5), [at(2026, 10, 11)]],
    ['day-of later today', date(), at(2026, 10, 11, 8), [at(2026, 10, 11)]],
    [
      'day-of already fired today rolls to next year',
      date(),
      at(2026, 10, 11, 10),
      [at(2027, 10, 4), at(2027, 10, 11)],
    ],
    ['lead alert crosses new year', date({ month: 1, day: 3 }), at(2026, 12, 20), [at(2026, 12, 27), at(2027, 1, 3)]],
    [
      'feb 29 in a non-leap year uses feb 28',
      date({ month: 2, day: 29 }),
      at(2026, 1, 10),
      [at(2026, 2, 21), at(2026, 2, 28)],
    ],
    [
      'feb 29 waits for the next leap year',
      date({ month: 2, day: 29 }),
      at(2027, 3, 1),
      [at(2028, 2, 22), at(2028, 2, 29)],
    ],
    [
      'birth year does not stop yearly reminders',
      date({ year: 1990 }),
      at(2026, 9, 29, 10),
      [at(2026, 10, 4), at(2026, 10, 11)],
    ],
    [
      'one-time date in the future',
      date({ ...surgery, year: 2026 }),
      at(2026, 9, 29),
      [at(2026, 10, 26), at(2026, 11, 2)],
    ],
    ['one-time date in the past', date({ ...surgery, year: 2025 }), at(2026, 9, 29), []],
    ['one-time date passed this morning', date({ ...surgery, year: 2026 }), at(2026, 11, 2, 10), []],
    [
      'one-time date without a year repeats',
      date({ ...surgery, year: null }),
      at(2026, 11, 3),
      [at(2027, 10, 26), at(2027, 11, 2)],
    ],
  ])('%s', (_name, input, now, want) => {
    const got = computeReminders([input], now, settings);

    expect(got.map((r) => r.fireAt)).toEqual(want);
  });

  it('skips the lead alert when lead time is zero', () => {
    const got = computeReminders([date()], at(2026, 9, 29), { ...settings, leadDays: 0 });

    expect(got.map((r) => r.fireAt)).toEqual([at(2026, 10, 11)]);
  });

  it('uses the configured time of day', () => {
    const got = computeReminders([date()], at(2026, 9, 29), { leadDays: 7, hour: 18, minute: 30 });

    expect(got.map((r) => r.fireAt)).toEqual([at(2026, 10, 4, 18, 30), at(2026, 10, 11, 18, 30)]);
  });

  test.each([
    [7, 'In 7 days, on October 11.'],
    [1, 'In 1 day, on October 11.'],
  ])('lead body for %i days', (leadDays, want) => {
    const got = computeReminders([date()], at(2026, 9, 1), { ...settings, leadDays });

    expect(got[0].body).toBe(want);
    expect(got[1].body).toBe('Today, October 11.');
  });

  it('sorts alerts from all dates by fire time', () => {
    const dates = [date({ id: 1, month: 12, day: 1 }), date({ id: 2, month: 10, day: 20, displayName: 'Sam' })];

    const got = computeReminders(dates, at(2026, 9, 29), settings);

    expect(got.map((r) => r.fireAt)).toEqual([at(2026, 10, 13), at(2026, 10, 20), at(2026, 11, 24), at(2026, 12, 1)]);
  });

  it('keeps only the soonest alerts up to the limit', () => {
    const dates = Array.from({ length: 40 }, (_, i) => date({ id: i + 1, month: (i % 12) + 1, day: (i % 28) + 1 }));
    const now = at(2026, 9, 29);

    const got = computeReminders(dates, now, settings);

    expect(got).toHaveLength(64);
    expect(got).toEqual(computeReminders(dates, now, settings, Infinity).slice(0, 64));
  });
});

describe('reminderTitle', () => {
  test.each([
    ['birthday', date(), "Maggie's birthday"],
    ['other date', date({ kind: 'other', label: 'Anniversary', displayName: 'Sam' }), 'Sam: Anniversary'],
  ])('%s', (_name, input, want) => {
    expect(reminderTitle(input)).toBe(want);
  });
});
