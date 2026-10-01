import type { Field, FieldResponse, GiftsResponse, HealthResponse, NoteResponse } from './types';

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isBirthday(value: unknown): boolean {
  return (
    isObject(value) &&
    Number.isInteger(value.month) &&
    Number.isInteger(value.day) &&
    (value.year === null || Number.isInteger(value.year))
  );
}

function isMatch(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.person_id === 'number' &&
    isString(value.note) &&
    Array.isArray(value.changes) &&
    value.changes.every((c) => isObject(c) && isString(c.type))
  );
}

function isUnknownPerson(value: unknown): boolean {
  return isObject(value) && isString(value.name) && isString(value.text);
}

function isIdea(value: unknown): boolean {
  return isObject(value) && isString(value.text) && isString(value.why);
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  return isObject(value) && isString(value.status);
}

export function isFieldResponse(value: unknown, field: Field): value is FieldResponse {
  if (!isObject(value) || !isString(value.transcript)) {
    return false;
  }
  switch (field) {
    case 'birthday':
      return isBirthday(value.value);
    case 'nicknames':
    case 'interests':
      return isStringArray(value.value);
    default:
      return isString(value.value);
  }
}

export function isNoteResponse(value: unknown): value is NoteResponse {
  return (
    isObject(value) &&
    isString(value.transcript) &&
    isString(value.notes) &&
    Array.isArray(value.matches) &&
    value.matches.every(isMatch) &&
    Array.isArray(value.unknown) &&
    value.unknown.every(isUnknownPerson)
  );
}

export function isGiftsResponse(value: unknown): value is GiftsResponse {
  return isObject(value) && Array.isArray(value.ideas) && value.ideas.every(isIdea);
}
