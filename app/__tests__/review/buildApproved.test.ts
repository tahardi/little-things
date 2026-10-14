import type { Change, NoteResponse } from '@/api/types';
import { buildApproved, describeChange, hasEditableText, toDrafts } from '@/review/buildApproved';

function change(overrides: Partial<Change>): Change {
  return {
    type: 'add_interest',
    text: null,
    label: null,
    month: null,
    day: null,
    year: null,
    recurring: null,
    given_on: null,
    occasion: null,
    ...overrides,
  };
}

const result: NoteResponse = {
  transcript: 'Maggie is into pottery and Sam turns 30 on March 3rd',
  matches: [
    { person_id: 1, note: ' Into pottery. ', changes: [change({ type: 'add_interest', text: 'pottery' })] },
    { person_id: 2, note: 'Birthday March 3rd.', changes: [change({ type: 'set_birthday', month: 3, day: 3 })] },
  ],
  unknown: [],
  notes: '',
};

test('toDrafts approves every change', () => {
  const drafts = toDrafts(result);

  expect(drafts.map((d) => d.personId)).toEqual([1, 2]);
  expect(drafts.every((d) => d.changes.every((c) => c.approved))).toBe(true);
});

test('buildApproved keeps approved changes and trims notes', () => {
  const drafts = toDrafts(result);
  drafts[1].changes[0].approved = false;

  expect(buildApproved(drafts)).toEqual([
    { personId: 1, note: 'Into pottery.', changes: [change({ type: 'add_interest', text: 'pottery' })] },
    { personId: 2, note: 'Birthday March 3rd.', changes: [] },
  ]);
});

test('buildApproved drops a match with an empty note and no approved changes', () => {
  const drafts = toDrafts(result);
  drafts[0].note = '   ';
  drafts[0].changes[0].approved = false;

  expect(buildApproved(drafts).map((m) => m.personId)).toEqual([2]);
});

test.each([
  [change({ type: 'add_interest', text: 'pottery' }), 'Interest: pottery'],
  [change({ type: 'add_gift_idea', text: 'book stamp' }), 'Gift idea: book stamp'],
  [change({ type: 'add_gift_given', text: 'tickets' }), 'Gift given: tickets'],
  [
    change({ type: 'add_gift_given', text: 'tickets', given_on: '2026-07-23', occasion: 'birthday' }),
    'Gift given: tickets (2026-07-23, birthday)',
  ],
  [change({ type: 'add_gift_given', text: 'tickets', occasion: 'birthday' }), 'Gift given: tickets (birthday)'],
  [change({ type: 'set_birthday', month: 3, day: 3 }), 'Birthday: 3/3'],
  [change({ type: 'set_birthday', month: 3, day: 3, year: 1990 }), 'Birthday: 3/3/1990'],
  [
    change({ type: 'add_date', label: 'Anniversary', month: 6, day: 14, recurring: true }),
    'Anniversary: 6/14 (yearly)',
  ],
  [
    change({ type: 'add_date', label: 'Surgery', month: 11, day: 2, year: 2026, recurring: false }),
    'Surgery: 11/2/2026 (once)',
  ],
  [change({ type: 'set_address', text: '1 Main St' }), 'Address: 1 Main St'],
  [change({ type: 'set_phone', text: '555-0100' }), 'Phone: 555-0100'],
  [change({ type: 'set_relationship', text: 'college friend' }), 'Relationship: college friend'],
  [change({ type: 'set_preferred_name', text: 'Maggie' }), 'Preferred name: Maggie'],
  [change({ type: 'add_nickname', text: 'Mags' }), 'Nickname: Mags'],
])('describeChange(%p) is %p', (c, want) => {
  expect(describeChange(c)).toBe(want);
});

test.each([
  ['add_interest', true],
  ['set_phone', true],
  ['set_birthday', false],
  ['add_date', false],
] as const)('hasEditableText(%s) is %s', (type, want) => {
  expect(hasEditableText(change({ type }))).toBe(want);
});
