import {
  EMPTY_ANSWERS,
  STEPS,
  fieldErrorMessage,
  fromFieldValue,
  parseBirthday,
  splitList,
  toNewPerson,
  validateAnswers,
  type Answers,
} from '@/people/addPersonSteps';

const step = (field: string) => STEPS.find((s) => s.field === field)!;

describe('STEPS', () => {
  test('eight steps in order', () => {
    // given
    // when
    const fields = STEPS.map((s) => s.field);

    // then
    expect(fields).toEqual([
      'name',
      'preferred_name',
      'nicknames',
      'relationship',
      'birthday',
      'address',
      'phone',
      'interests',
    ]);
  });
});

describe('fromFieldValue', () => {
  test.each([
    ['text', step('name'), 'Margaret Lin', 'Margaret Lin'],
    ['list', step('nicknames'), ['Maggie', 'Mags'], 'Maggie, Mags'],
    ['birthday without year', step('birthday'), { month: 3, day: 14, year: null }, { month: '3', day: '14', year: '' }],
    [
      'birthday with year',
      step('birthday'),
      { month: 3, day: 14, year: 1961 },
      { month: '3', day: '14', year: '1961' },
    ],
  ])('%s', (_name, s, value, want) => {
    // given
    // when
    const got = fromFieldValue(s, value);

    // then
    expect(got).toEqual(want);
  });
});

describe('splitList', () => {
  test.each([
    ['trims and drops blanks', ' chess, ,gardening ,', ['chess', 'gardening']],
    ['dedupes ignoring case', 'Chess, chess, CHESS', ['Chess']],
    ['empty', '', []],
  ])('%s', (_name, text, want) => {
    // given
    // when
    const got = splitList(text);

    // then
    expect(got).toEqual(want);
  });
});

describe('parseBirthday', () => {
  test.each([
    ['all blank is no birthday', { month: '', day: '', year: '' }, null],
    ['month and day', { month: '3', day: '14', year: '' }, { month: 3, day: 14, year: null }],
    ['with year', { month: '3', day: '14', year: '1961' }, { month: 3, day: 14, year: 1961 }],
    ['feb 29', { month: '2', day: '29', year: '' }, { month: 2, day: 29, year: null }],
    ['feb 30', { month: '2', day: '30', year: '' }, 'invalid'],
    ['day missing', { month: '3', day: '', year: '' }, 'invalid'],
    ['bad year', { month: '3', day: '14', year: '61' }, 'invalid'],
  ])('%s', (_name, draft, want) => {
    // given
    // when
    const got = parseBirthday(draft);

    // then
    expect(got).toEqual(want);
  });
});

describe('validateAnswers', () => {
  test.each([
    ['blank name', { ...EMPTY_ANSWERS, name: '  ' }, 'Name is required'],
    [
      'bad birthday',
      { ...EMPTY_ANSWERS, name: 'Priya Nair', birthday: { month: '2', day: '30', year: '' } },
      'Birthday is not a real date',
    ],
    ['ok', { ...EMPTY_ANSWERS, name: 'Priya Nair' }, null],
  ])('%s', (_name, answers, want) => {
    // given
    // when
    const got = validateAnswers(answers as Answers);

    // then
    expect(got).toBe(want);
  });
});

describe('toNewPerson', () => {
  test('happy path - maps answers and writes one note per answered step', () => {
    // given
    const answers: Answers = {
      ...EMPTY_ANSWERS,
      name: ' Samuel Ortiz ',
      preferred_name: 'Sam',
      nicknames: 'Sammy, sammy',
      birthday: { month: '3', day: '14', year: '' },
      interests: 'chess, gardening',
    };

    // when
    const got = toNewPerson(answers);

    // then
    expect(got).toEqual({
      name: 'Samuel Ortiz',
      preferredName: 'Sam',
      nicknames: ['Sammy'],
      relationship: null,
      birthday: { month: 3, day: 14, year: null },
      address: null,
      phone: null,
      interests: ['chess', 'gardening'],
      notes: [
        'Name: Samuel Ortiz',
        'Preferred name: Sam',
        'Nicknames: Sammy',
        'Birthday: 03/14',
        'Interests: chess, gardening',
      ],
    });
  });
});

describe('fieldErrorMessage', () => {
  test.each([
    ['no_speech', "Didn't catch that"],
    ['unreachable', "Can't reach the backend. Type the answer instead."],
    ['unauthorized', 'The backend key is wrong. Check Settings, or type the answer.'],
    ['unreadable_date', "Couldn't read a date. Record again or type it."],
    ['upstream_failed', 'The backend had a problem. Record again or type the answer.'],
  ] as const)('%s', (code, want) => {
    // given
    // when
    const got = fieldErrorMessage(code);

    // then
    expect(got).toBe(want);
  });
});
