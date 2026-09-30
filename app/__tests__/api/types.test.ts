import fs from 'fs';
import path from 'path';

import type { ApiPerson, FieldResponse, GiftsRequest, GiftsResponse, HealthResponse, NoteResponse } from '@/api/types';

type ErrorResponse = { error: { code: string; message: string } };

function readFixture(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../../api/testdata', file), 'utf8'));
}

const noChange = {
  text: null,
  label: null,
  month: null,
  day: null,
  year: null,
  recurring: null,
  given_on: null,
  occasion: null,
};

const health: HealthResponse = { status: 'ok' };

const fieldPhone: FieldResponse = {
  transcript: 'five five five, one two three, four five six seven',
  value: '555-123-4567',
};

const fieldInterests: FieldResponse = {
  transcript: 'She loves swimming, pottery, and anything with whales on it.',
  value: ['swimming', 'pottery', 'whales'],
};

const fieldBirthday: FieldResponse = {
  transcript: 'October eleventh',
  value: { month: 10, day: 11, year: null },
};

const notePeople: ApiPerson[] = [
  { id: 1, name: 'Margaret Lin', preferred_name: 'Maggie', nicknames: ['Mags'], relationship: 'sister-in-law' },
  { id: 2, name: 'Sam Ortiz', preferred_name: null, nicknames: ['Sammy'], relationship: 'college friend' },
  { id: 3, name: 'Priya Nair', preferred_name: null, nicknames: [], relationship: null },
];

const noteResponse: NoteResponse = {
  transcript:
    "Maggie is getting into pottery and wants a new wheel. Sammy's birthday is March third. " +
    'Also ran into Dave, who just got into fly fishing.',
  matches: [
    {
      person_id: 1,
      note: 'Getting into pottery and wants a new wheel.',
      changes: [
        { ...noChange, type: 'add_interest', text: 'pottery' },
        { ...noChange, type: 'add_gift_idea', text: 'pottery wheel' },
      ],
    },
    {
      person_id: 2,
      note: 'Birthday is March 3rd.',
      changes: [{ ...noChange, type: 'set_birthday', month: 3, day: 3 }],
    },
  ],
  unknown: [{ name: 'Dave', text: 'Just got into fly fishing.' }],
  notes: '"Sammy" matched Sam Ortiz by nickname.',
};

const giftsRequest: GiftsRequest = {
  name: 'Margaret Lin',
  preferred_name: 'Maggie',
  relationship: 'sister-in-law',
  interests: ['swimming', 'pottery', 'whales'],
  gift_ideas: ['pottery wheel'],
  gifts_given: ['open water swim cap'],
  notes: ['Getting into pottery and wants a new wheel.', 'Training for a lake swim in August.'],
  occasion: 'birthday',
};

const giftsResponse: GiftsResponse = {
  ideas: [
    { text: 'Pottery glaze sampler set', why: 'She just started pottery and a glaze set lets her finish pieces.' },
    { text: 'Whale-shaped ceramic planter', why: 'Combines her love of whales with her new pottery interest.' },
    { text: 'Waterproof swim watch', why: 'Useful while she trains for the August lake swim.' },
    { text: 'Beginner wheel-throwing class', why: 'A class helps her get more out of the wheel she wants.' },
    { text: 'Anti-fog swim goggles', why: 'Open water swimmers replace goggles often, and she already has a cap.' },
  ],
};

const errorNoSpeech: ErrorResponse = { error: { code: 'no_speech', message: 'no speech found' } };
const errorUnreadableDate: ErrorResponse = { error: { code: 'unreadable_date', message: 'could not read a date' } };
const errorUnauthorized: ErrorResponse = { error: { code: 'unauthorized', message: 'missing or invalid key' } };

describe('api fixtures', () => {
  test.each([
    ['health-response.json', health],
    ['field-response-phone.json', fieldPhone],
    ['field-response-interests.json', fieldInterests],
    ['field-response-birthday.json', fieldBirthday],
    ['note-people.json', notePeople],
    ['note-response.json', noteResponse],
    ['gifts-request.json', giftsRequest],
    ['gifts-response.json', giftsResponse],
    ['error-no-speech.json', errorNoSpeech],
    ['error-unreadable-date.json', errorUnreadableDate],
    ['error-unauthorized.json', errorUnauthorized],
  ])('%s matches the typed example', (file, want) => {
    const got = readFixture(file);

    expect(got).toStrictEqual(want);
  });
});
