import { formatMonthDay, localIsoDate } from '@/dates/format';

describe('formatMonthDay', () => {
  test.each([
    ['pads without year', 3, 4, null, '03/04'],
    ['with year', 10, 11, 1994, '10/11/1994'],
  ])('%s', (_name, month, day, year, want) => {
    // given
    // when
    const got = formatMonthDay(month, day, year);

    // then
    expect(got).toBe(want);
  });
});

describe('localIsoDate', () => {
  test('formats the local calendar date', () => {
    // given
    const date = new Date(2026, 0, 5, 23, 30);

    // when
    const got = localIsoDate(date);

    // then
    expect(got).toBe('2026-01-05');
  });
});
