import { toCalendarDates } from '@/calendar/payload';
import type { DateWithPerson } from '@/db/types';

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

describe('toCalendarDates', () => {
  test.each([
    ['birthday', date(), { id: 1, title: "Maggie's birthday", month: 10, day: 11, year: null, recurring: true }],
    [
      'other date with year',
      date({
        id: 7,
        kind: 'other',
        label: 'Surgery',
        month: 11,
        day: 2,
        year: 2026,
        recurring: false,
        displayName: 'Sam',
      }),
      { id: 7, title: 'Sam: Surgery', month: 11, day: 2, year: 2026, recurring: false },
    ],
    [
      'feb 29 is sent as stored',
      date({ month: 2, day: 29, year: 1992 }),
      { id: 1, title: "Maggie's birthday", month: 2, day: 29, year: 1992, recurring: true },
    ],
    [
      'quotes in names are kept',
      date({ displayName: 'Sam "Sammy" Ortiz' }),
      { id: 1, title: 'Sam "Sammy" Ortiz\'s birthday', month: 10, day: 11, year: null, recurring: true },
    ],
  ])('%s', (_name, input, want) => {
    expect(toCalendarDates([input])).toEqual([want]);
  });

  it('keeps the input order and drops local-only fields', () => {
    const got = toCalendarDates([date({ id: 2 }), date({ id: 1, calendarEventId: 'abc' })]);

    expect(got.map((d) => d.id)).toEqual([2, 1]);
    expect(Object.keys(got[1]).sort()).toEqual(['day', 'id', 'month', 'recurring', 'title', 'year']);
  });

  it('returns an empty list for no dates', () => {
    expect(toCalendarDates([])).toEqual([]);
  });
});
