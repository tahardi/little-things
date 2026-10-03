import { addDate, deleteDate, listAllDates, setBirthday, setCalendarEventId, updateDate } from '@/db/dates';
import type { Db } from '@/db/db';
import { createPerson, getPersonDetail } from '@/db/people';
import type { NewDate } from '@/db/types';

import { createTestDb } from '../../testing/testDb';

const NOW = new Date('2026-10-01T12:00:00Z');
const ANNIVERSARY: NewDate = { kind: 'other', label: 'Anniversary', month: 6, day: 14, year: 2019, recurring: true };

async function addPerson(db: Db, name: string, preferredName: string | null = null): Promise<number> {
  return createPerson(
    db,
    {
      name,
      preferredName,
      nicknames: [],
      relationship: null,
      birthday: null,
      address: null,
      phone: null,
      interests: [],
      notes: [],
    },
    NOW,
  );
}

describe('setBirthday', () => {
  test('happy path - inserts then updates in place', async () => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');

    await setBirthday(db, personId, { month: 3, day: 3, year: null });
    const first = (await getPersonDetail(db, personId))!.dates;
    await setCalendarEventId(db, first[0].id, 'evt-1');
    await setBirthday(db, personId, { month: 4, day: 5, year: 1990 });

    const after = (await getPersonDetail(db, personId))!.dates;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      id: first[0].id,
      kind: 'birthday',
      label: 'Birthday',
      month: 4,
      day: 5,
      year: 1990,
      recurring: true,
      calendarEventId: 'evt-1',
    });
  });

  test.each([
    ['Feb 29 is valid', { month: 2, day: 29, year: null }, undefined],
    ['month 13 is invalid', { month: 13, day: 1, year: null }, 'invalid date'],
  ])('%s', async (_name, birthday, wantError) => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');

    const result = setBirthday(db, personId, birthday);

    if (wantError) {
      await expect(result).rejects.toThrow(wantError);
    } else {
      await expect(result).resolves.toBeUndefined();
    }
  });
});

describe('addDate', () => {
  test('happy path - stores the date', async () => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');

    const id = await addDate(db, personId, ANNIVERSARY);

    const detail = await getPersonDetail(db, personId);
    expect(detail?.dates).toEqual([
      {
        id,
        personId,
        kind: 'other',
        label: 'Anniversary',
        month: 6,
        day: 14,
        year: 2019,
        recurring: true,
        calendarEventId: null,
      },
    ]);
  });

  test.each([
    ['birthday kind', { ...ANNIVERSARY, kind: 'birthday' as const }, 'use setBirthday for birthdays'],
    ['blank label', { ...ANNIVERSARY, label: ' ' }, 'text is required'],
    ['April 31', { ...ANNIVERSARY, month: 4, day: 31 }, 'invalid date'],
  ])('error - %s', async (_name, date, want) => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');

    await expect(addDate(db, personId, date)).rejects.toThrow(want);
  });
});

describe('updateDate', () => {
  test('happy path - replaces every editable field', async () => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');
    const id = await addDate(db, personId, ANNIVERSARY);

    await updateDate(db, id, { kind: 'other', label: 'Move-in day', month: 8, day: 1, year: null, recurring: false });

    const detail = await getPersonDetail(db, personId);
    expect(detail?.dates[0]).toMatchObject({
      label: 'Move-in day',
      month: 8,
      day: 1,
      year: null,
      recurring: false,
    });
  });

  test.each([
    ['blank label', { ...ANNIVERSARY, label: '' }, 'text is required'],
    ['invalid day', { ...ANNIVERSARY, month: 2, day: 30 }, 'invalid date'],
  ])('error - %s', async (_name, date, want) => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');
    const id = await addDate(db, personId, ANNIVERSARY);

    await expect(updateDate(db, id, date)).rejects.toThrow(want);
  });
});

describe('deleteDate', () => {
  test('happy path - removes the row', async () => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');
    const id = await addDate(db, personId, ANNIVERSARY);

    await deleteDate(db, id);

    expect((await getPersonDetail(db, personId))?.dates).toEqual([]);
  });
});

describe('listAllDates', () => {
  test('happy path - uses display name and orders by month, day, name', async () => {
    const db = await createTestDb();
    const maggie = await addPerson(db, 'Margaret Lin', 'Maggie');
    const sam = await addPerson(db, 'Sam Ortiz');
    await setBirthday(db, sam, { month: 6, day: 14, year: null });
    await addDate(db, maggie, ANNIVERSARY);
    await setBirthday(db, maggie, { month: 1, day: 9, year: null });

    const dates = await listAllDates(db);

    expect(dates.map((d) => [d.displayName, d.month, d.day])).toEqual([
      ['Maggie', 1, 9],
      ['Maggie', 6, 14],
      ['Sam Ortiz', 6, 14],
    ]);
  });
});

describe('setCalendarEventId', () => {
  test('happy path - stores and clears', async () => {
    const db = await createTestDb();
    const personId = await addPerson(db, 'Priya Nair');
    const id = await addDate(db, personId, ANNIVERSARY);

    await setCalendarEventId(db, id, 'evt-9');
    expect((await getPersonDetail(db, personId))?.dates[0].calendarEventId).toBe('evt-9');

    await setCalendarEventId(db, id, null);
    expect((await getPersonDetail(db, personId))?.dates[0].calendarEventId).toBeNull();
  });
});
