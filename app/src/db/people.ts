import type { ApiPerson } from '@/api/types';
import { isValidMonthDay } from '@/dates/valid';

import { clean, requireText } from './clean';
import { setBirthday, toDate, type DateDbRow } from './dates';
import type { Db } from './db';
import { addNote } from './notes';
import type { GiftGivenRow, GiftIdeaRow, Item, NewPerson, NoteRow, Person, PersonDetail, PersonPatch } from './types';

type PersonRow = {
  id: number;
  name: string;
  preferred_name: string | null;
  relationship: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

function toPerson(r: PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    preferredName: r.preferred_name,
    relationship: r.relationship,
    address: r.address,
    phone: r.phone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function createPerson(db: Db, p: NewPerson, now: Date): Promise<number> {
  const name = requireText(p.name);
  if (p.birthday && !isValidMonthDay(p.birthday.month, p.birthday.day)) {
    throw new Error('invalid date');
  }
  let id = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const ts = now.toISOString();
    const r = await txn.runAsync(
      `INSERT INTO people (name, preferred_name, relationship, address, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      name,
      clean(p.preferredName),
      clean(p.relationship),
      clean(p.address),
      clean(p.phone),
      ts,
      ts,
    );
    id = r.lastInsertRowId;
    for (const nickname of p.nicknames.filter((n) => clean(n) !== null)) {
      await addNickname(txn, id, nickname);
    }
    for (const interest of p.interests.filter((i) => clean(i) !== null)) {
      await addInterest(txn, id, interest);
    }
    if (p.birthday) {
      await setBirthday(txn, id, p.birthday);
    }
    for (const note of p.notes.filter((n) => clean(n) !== null)) {
      await addNote(txn, id, note, now, null);
    }
  });
  return id;
}

export async function updatePerson(db: Db, id: number, patch: PersonPatch, now: Date): Promise<void> {
  const current = await db.getFirstAsync<PersonRow>('SELECT * FROM people WHERE id = ?', id);
  if (!current) {
    throw new Error('person not found');
  }
  const next = { ...toPerson(current), ...patch };
  await db.runAsync(
    `UPDATE people SET name = ?, preferred_name = ?, relationship = ?, address = ?, phone = ?, updated_at = ?
     WHERE id = ?`,
    requireText(next.name),
    clean(next.preferredName),
    clean(next.relationship),
    clean(next.address),
    clean(next.phone),
    now.toISOString(),
    id,
  );
}

export async function deletePerson(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM people WHERE id = ?', id);
}

export async function addNickname(db: Db, personId: number, text: string): Promise<number> {
  const value = requireText(text);
  await db.runAsync(
    'INSERT INTO nicknames (person_id, text) VALUES (?, ?) ON CONFLICT (person_id, text) DO NOTHING',
    personId,
    value,
  );
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM nicknames WHERE person_id = ? AND text = ?',
    personId,
    value,
  );
  if (!row) {
    throw new Error('person not found');
  }
  return row.id;
}

export async function addInterest(db: Db, personId: number, text: string): Promise<number> {
  const value = requireText(text);
  await db.runAsync(
    `INSERT INTO interests (person_id, text, created_at) VALUES (?, ?, ?)
     ON CONFLICT (person_id, text) DO NOTHING`,
    personId,
    value,
    new Date().toISOString(),
  );
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM interests WHERE person_id = ? AND text = ?',
    personId,
    value,
  );
  if (!row) {
    throw new Error('person not found');
  }
  return row.id;
}

export async function removeNickname(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM nicknames WHERE id = ?', id);
}

export async function removeInterest(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM interests WHERE id = ?', id);
}

export async function listPeople(db: Db): Promise<Person[]> {
  const rows = await db.getAllAsync<PersonRow>(
    'SELECT * FROM people ORDER BY lower(coalesce(preferred_name, name)), id',
  );
  return rows.map(toPerson);
}

export async function listApiPeople(db: Db): Promise<ApiPerson[]> {
  const people = await listPeople(db);
  const nicknames = await db.getAllAsync<{ person_id: number; text: string }>(
    'SELECT person_id, text FROM nicknames ORDER BY id',
  );
  const byPerson = new Map<number, string[]>();
  for (const n of nicknames) {
    byPerson.set(n.person_id, [...(byPerson.get(n.person_id) ?? []), n.text]);
  }
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    preferred_name: p.preferredName,
    nicknames: byPerson.get(p.id) ?? [],
    relationship: p.relationship,
  }));
}

export async function getPersonDetail(db: Db, id: number): Promise<PersonDetail | null> {
  const row = await db.getFirstAsync<PersonRow>('SELECT * FROM people WHERE id = ?', id);
  if (!row) {
    return null;
  }
  const nicknames = await db.getAllAsync<Item>('SELECT id, text FROM nicknames WHERE person_id = ? ORDER BY id', id);
  const interests = await db.getAllAsync<Item>('SELECT id, text FROM interests WHERE person_id = ? ORDER BY id', id);
  const giftIdeas = await db.getAllAsync<{
    id: number;
    text: string;
    source: GiftIdeaRow['source'];
    created_at: string;
  }>('SELECT id, text, source, created_at FROM gift_ideas WHERE person_id = ? ORDER BY id', id);
  const giftsGiven = await db.getAllAsync<{
    id: number;
    text: string;
    given_on: string | null;
    occasion: string | null;
    created_at: string;
  }>('SELECT id, text, given_on, occasion, created_at FROM gifts_given WHERE person_id = ? ORDER BY id', id);
  const dates = await db.getAllAsync<DateDbRow>('SELECT * FROM dates WHERE person_id = ? ORDER BY id', id);
  const notes = await db.getAllAsync<{
    id: number;
    person_id: number;
    text: string;
    created_at: string;
    clip_id: number | null;
  }>('SELECT * FROM notes WHERE person_id = ? ORDER BY created_at DESC, id DESC', id);
  return {
    ...toPerson(row),
    nicknames,
    interests,
    giftIdeas: giftIdeas.map((g): GiftIdeaRow => ({
      id: g.id,
      text: g.text,
      source: g.source,
      createdAt: g.created_at,
    })),
    giftsGiven: giftsGiven.map((g): GiftGivenRow => ({
      id: g.id,
      text: g.text,
      givenOn: g.given_on,
      occasion: g.occasion,
      createdAt: g.created_at,
    })),
    dates: dates.map(toDate),
    notes: notes.map((n): NoteRow => ({
      id: n.id,
      personId: n.person_id,
      text: n.text,
      createdAt: n.created_at,
      clipId: n.clip_id,
    })),
  };
}

export async function listPersonDetails(db: Db): Promise<PersonDetail[]> {
  const people = await listPeople(db);
  const details: PersonDetail[] = [];
  for (const p of people) {
    const detail = await getPersonDetail(db, p.id);
    if (detail) {
      details.push(detail);
    }
  }
  return details;
}
