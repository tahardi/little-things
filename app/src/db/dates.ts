import { isValidMonthDay } from '@/dates/valid';
import type { Birthday } from '@/api/types';

import { requireText } from './clean';
import type { Db } from './db';
import type { DateRow, DateWithPerson, NewDate } from './types';

export type DateDbRow = {
  id: number;
  person_id: number;
  kind: 'birthday' | 'other';
  label: string;
  month: number;
  day: number;
  year: number | null;
  recurring: number;
  calendar_event_id: string | null;
};

export function toDate(r: DateDbRow): DateRow {
  return {
    id: r.id,
    personId: r.person_id,
    kind: r.kind,
    label: r.label,
    month: r.month,
    day: r.day,
    year: r.year,
    recurring: r.recurring === 1,
    calendarEventId: r.calendar_event_id,
  };
}

function checkDate(label: string, month: number, day: number): string {
  const text = requireText(label);
  if (!isValidMonthDay(month, day)) {
    throw new Error('invalid date');
  }
  return text;
}

export async function setBirthday(db: Db, personId: number, b: Birthday): Promise<void> {
  if (!isValidMonthDay(b.month, b.day)) {
    throw new Error('invalid date');
  }
  await db.runAsync(
    `INSERT INTO dates (person_id, kind, label, month, day, year, recurring)
     VALUES (?, 'birthday', 'Birthday', ?, ?, ?, 1)
     ON CONFLICT (person_id) WHERE kind = 'birthday'
     DO UPDATE SET month = excluded.month, day = excluded.day, year = excluded.year`,
    personId,
    b.month,
    b.day,
    b.year,
  );
}

export async function addDate(db: Db, personId: number, d: NewDate): Promise<number> {
  if (d.kind === 'birthday') {
    throw new Error('use setBirthday for birthdays');
  }
  const label = checkDate(d.label, d.month, d.day);
  const r = await db.runAsync(
    "INSERT INTO dates (person_id, kind, label, month, day, year, recurring) VALUES (?, 'other', ?, ?, ?, ?, ?)",
    personId,
    label,
    d.month,
    d.day,
    d.year,
    d.recurring ? 1 : 0,
  );
  return r.lastInsertRowId;
}

export async function updateDate(db: Db, id: number, d: NewDate): Promise<void> {
  const label = checkDate(d.label, d.month, d.day);
  await db.runAsync(
    "UPDATE dates SET label = ?, month = ?, day = ?, year = ?, recurring = ? WHERE id = ? AND kind = 'other'",
    label,
    d.month,
    d.day,
    d.year,
    d.recurring ? 1 : 0,
    id,
  );
}

export async function deleteDate(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM dates WHERE id = ?', id);
}

export async function listAllDates(db: Db): Promise<DateWithPerson[]> {
  const rows = await db.getAllAsync<DateDbRow & { display_name: string }>(
    `SELECT d.*, coalesce(p.preferred_name, p.name) AS display_name
     FROM dates d JOIN people p ON p.id = d.person_id
     ORDER BY d.month, d.day, lower(display_name), d.id`,
  );
  return rows.map((r) => ({ ...toDate(r), displayName: r.display_name }));
}

export async function setCalendarEventId(db: Db, dateId: number, eventId: string | null): Promise<void> {
  await db.runAsync('UPDATE dates SET calendar_event_id = ? WHERE id = ?', eventId, dateId);
}
