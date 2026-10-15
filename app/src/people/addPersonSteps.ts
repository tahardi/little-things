import type { Birthday, ErrorCode, Field, FieldValue } from '@/api/types';
import { isValidMonthDay } from '@/dates/valid';
import type { NewPerson } from '@/db/types';

export type StepKind = 'text' | 'list' | 'birthday';
export type Step = { field: Field; label: string; prompt: string; kind: StepKind };

export const STEPS: Step[] = [
  { field: 'name', label: 'Name', prompt: 'What is their full name?', kind: 'text' },
  { field: 'preferred_name', label: 'Preferred name', prompt: 'What do they like to be called?', kind: 'text' },
  { field: 'nicknames', label: 'Nicknames', prompt: 'Any nicknames?', kind: 'list' },
  { field: 'relationship', label: 'Relationship', prompt: 'How do you know them?', kind: 'text' },
  { field: 'birthday', label: 'Birthday', prompt: 'When is their birthday?', kind: 'birthday' },
  { field: 'address', label: 'Address', prompt: 'What is their address?', kind: 'text' },
  { field: 'phone', label: 'Phone', prompt: 'What is their phone number?', kind: 'text' },
  { field: 'interests', label: 'Interests', prompt: 'What are they into?', kind: 'list' },
];

export type BirthdayDraft = { month: string; day: string; year: string };
export type Answers = { [K in Field]: K extends 'birthday' ? BirthdayDraft : string };

export const EMPTY_BIRTHDAY: BirthdayDraft = { month: '', day: '', year: '' };
export const EMPTY_ANSWERS: Answers = {
  name: '',
  preferred_name: '',
  nicknames: '',
  relationship: '',
  birthday: EMPTY_BIRTHDAY,
  address: '',
  phone: '',
  interests: '',
};

export function fromFieldValue(step: Step, value: FieldValue): string | BirthdayDraft {
  if (step.kind === 'birthday') {
    const birthday = value as Birthday;
    return {
      month: String(birthday.month),
      day: String(birthday.day),
      year: birthday.year === null ? '' : String(birthday.year),
    };
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

export function splitList(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of text.split(',')) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (item === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(item);
  }
  return items;
}

export function parseBirthday(draft: BirthdayDraft): Birthday | null | 'invalid' {
  const month = draft.month.trim();
  const day = draft.day.trim();
  const year = draft.year.trim();
  if (month === '' && day === '' && year === '') {
    return null;
  }
  if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day) || !isValidMonthDay(Number(month), Number(day))) {
    return 'invalid';
  }
  if (year === '') {
    return { month: Number(month), day: Number(day), year: null };
  }
  if (!/^\d{4}$/.test(year)) {
    return 'invalid';
  }
  return { month: Number(month), day: Number(day), year: Number(year) };
}

export function validateAnswers(answers: Answers): string | null {
  if (answers.name.trim() === '') {
    return 'Name is required';
  }
  if (parseBirthday(answers.birthday) === 'invalid') {
    return 'Birthday is not a real date';
  }
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatBirthday(birthday: Birthday): string {
  const base = `${pad(birthday.month)}/${pad(birthday.day)}`;
  return birthday.year === null ? base : `${base}/${birthday.year}`;
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function toNewPerson(answers: Answers): NewPerson {
  const parsed = parseBirthday(answers.birthday);
  const birthday = parsed === 'invalid' ? null : parsed;
  const notes: string[] = [];
  for (const step of STEPS) {
    let shown: string;
    if (step.kind === 'birthday') {
      shown = birthday ? formatBirthday(birthday) : '';
    } else if (step.kind === 'list') {
      shown = splitList(answers[step.field] as string).join(', ');
    } else {
      shown = (answers[step.field] as string).trim();
    }
    if (shown !== '') {
      notes.push(`${step.label}: ${shown}`);
    }
  }
  return {
    name: answers.name.trim(),
    preferredName: orNull(answers.preferred_name),
    nicknames: splitList(answers.nicknames),
    relationship: orNull(answers.relationship),
    birthday,
    address: orNull(answers.address),
    phone: orNull(answers.phone),
    interests: splitList(answers.interests),
    notes,
  };
}

export function fieldErrorMessage(code: ErrorCode): string {
  switch (code) {
    case 'no_speech':
      return "Didn't catch that";
    case 'unreachable':
      return "Can't reach the backend. Type the answer instead.";
    case 'unauthorized':
      return 'The backend key is wrong. Check Settings, or type the answer.';
    case 'unreadable_date':
      return "Couldn't read a date. Record again or type it.";
    default:
      return 'The backend had a problem. Record again or type the answer.';
  }
}
