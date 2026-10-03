import fs from 'node:fs';
import path from 'node:path';

import { isFieldResponse, isGiftsResponse, isHealthResponse, isNoteResponse } from '@/api/guards';
import type { Field } from '@/api/types';

function fixture(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../../api/testdata', file), 'utf8'));
}

describe('isHealthResponse', () => {
  it.each([
    [fixture('health-response.json'), true],
    [{ status: 3 }, false],
    [null, false],
  ])('%j is %s', (value, want) => {
    expect(isHealthResponse(value)).toBe(want);
  });
});

describe('isFieldResponse', () => {
  it.each([
    [fixture('field-response-phone.json'), 'phone', true],
    [fixture('field-response-interests.json'), 'interests', true],
    [fixture('field-response-birthday.json'), 'birthday', true],
    [{ transcript: 't', value: { month: 3, day: 4, year: 1990 } }, 'birthday', true],
    [{ transcript: 5 }, 'phone', false],
    [{ transcript: 't', value: 3 }, 'phone', false],
    [{ transcript: 't', value: { month: 3 } }, 'birthday', false],
    [{ transcript: 't', value: { month: 3, day: 1.5, year: null } }, 'birthday', false],
    [{ transcript: 't', value: [1] }, 'nicknames', false],
    [fixture('field-response-phone.json'), 'birthday', false],
    [fixture('field-response-interests.json'), 'name', false],
  ] as [unknown, Field, boolean][])('%j for %s is %s', (value, field, want) => {
    expect(isFieldResponse(value, field)).toBe(want);
  });
});

describe('isNoteResponse', () => {
  const note = fixture('note-response.json') as { matches: Record<string, unknown>[] };

  it.each([
    [note, true],
    [{ ...note, matches: [{ ...note.matches[0], changes: undefined }] }, false],
    [{ ...note, matches: [{ ...note.matches[0], person_id: '1' }] }, false],
    [{ ...note, notes: 5 }, false],
    [{ ...note, unknown: [{ name: 'Dave' }] }, false],
    [{ transcript: 't', matches: [], unknown: [], notes: '' }, true],
  ])('case %#', (value, want) => {
    expect(isNoteResponse(value)).toBe(want);
  });
});

describe('isGiftsResponse', () => {
  it.each([
    [fixture('gifts-response.json'), true],
    [{ ideas: [{ text: 'a' }] }, false],
    [{ ideas: 'x' }, false],
  ])('case %#', (value, want) => {
    expect(isGiftsResponse(value)).toBe(want);
  });
});
