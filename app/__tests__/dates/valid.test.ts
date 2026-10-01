import { isValidMonthDay } from '@/dates/valid';

describe('isValidMonthDay', () => {
  test.each([
    [1, 1, true],
    [1, 31, true],
    [2, 29, true],
    [2, 30, false],
    [4, 30, true],
    [4, 31, false],
    [12, 31, true],
    [0, 10, false],
    [13, 1, false],
    [6, 0, false],
    [1.5, 1, false],
    [1, 2.5, false],
  ])('month %p day %p is %p', (month, day, want) => {
    expect(isValidMonthDay(month, day)).toBe(want);
  });
});
