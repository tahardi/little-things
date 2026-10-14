import { parseDateDraft } from '@/dates/draft';

describe('parseDateDraft', () => {
  test.each([
    ['month and day only', { month: '3', day: '14', year: '' }, { month: 3, day: 14, year: null }],
    ['with year', { month: '03', day: '14', year: '1961' }, { month: 3, day: 14, year: 1961 }],
    ['trims spaces', { month: ' 6 ', day: ' 1', year: ' 2020 ' }, { month: 6, day: 1, year: 2020 }],
    ['feb 29 is valid', { month: '2', day: '29', year: '' }, { month: 2, day: 29, year: null }],
    ['feb 30 is invalid', { month: '2', day: '30', year: '' }, null],
    ['month 13 is invalid', { month: '13', day: '1', year: '' }, null],
    ['blank month', { month: '', day: '1', year: '' }, null],
    ['letters', { month: 'march', day: '1', year: '' }, null],
    ['decimal day', { month: '3', day: '1.5', year: '' }, null],
    ['two digit year', { month: '3', day: '1', year: '61' }, null],
  ])('%s', (_name, draft, want) => {
    // given
    // when
    const got = parseDateDraft(draft);

    // then
    expect(got).toEqual(want);
  });
});
