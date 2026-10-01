import type { Db } from '@/db/db';
import {
  addInterest,
  addNickname,
  createPerson,
  deletePerson,
  getPersonDetail,
  listApiPeople,
  listPeople,
  listPersonDetails,
  removeInterest,
  removeNickname,
  updatePerson,
} from '@/db/people';
import type { NewPerson } from '@/db/types';

import { createTestDb } from '../../testing/testDb';

const NOW = new Date('2026-10-01T12:00:00Z');
const LATER = new Date('2026-10-02T08:30:00Z');

function newPerson(fields: Partial<NewPerson>): NewPerson {
  return {
    name: 'Priya Nair',
    preferredName: null,
    nicknames: [],
    relationship: null,
    birthday: null,
    address: null,
    phone: null,
    interests: [],
    notes: [],
    ...fields,
  };
}

async function count(db: Db, table: string, personId: number): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE person_id = ?`, personId);
  return row?.n ?? 0;
}

describe('createPerson', () => {
  test('happy path - stores every field', async () => {
    const db = await createTestDb();

    const id = await createPerson(
      db,
      newPerson({
        name: 'Margaret Lin',
        preferredName: 'Maggie',
        nicknames: ['Mags', 'Peg'],
        relationship: 'cousin',
        birthday: { month: 3, day: 3, year: null },
        address: '12 Elm St',
        phone: '555-0100',
        interests: ['pottery', 'hiking'],
        notes: ['Met at the lake.', 'Loves tea.'],
      }),
      NOW,
    );

    const detail = await getPersonDetail(db, id);
    expect(detail).toMatchObject({
      id,
      name: 'Margaret Lin',
      preferredName: 'Maggie',
      relationship: 'cousin',
      address: '12 Elm St',
      phone: '555-0100',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(detail?.nicknames.map((n) => n.text)).toEqual(['Mags', 'Peg']);
    expect(detail?.interests.map((i) => i.text)).toEqual(['pottery', 'hiking']);
    expect(detail?.dates).toEqual([
      {
        id: expect.any(Number),
        personId: id,
        kind: 'birthday',
        label: 'Birthday',
        month: 3,
        day: 3,
        year: null,
        recurring: true,
        calendarEventId: null,
      },
    ]);
    expect(detail?.notes.map((n) => [n.text, n.clipId])).toEqual([
      ['Loves tea.', null],
      ['Met at the lake.', null],
    ]);
  });

  test('error - blank name inserts nothing', async () => {
    const db = await createTestDb();

    await expect(createPerson(db, newPerson({ name: '  ' }), NOW)).rejects.toThrow('text is required');

    expect(await listPeople(db)).toEqual([]);
  });

  test('error - invalid birthday inserts nothing', async () => {
    const db = await createTestDb();

    await expect(createPerson(db, newPerson({ birthday: { month: 2, day: 30, year: null } }), NOW)).rejects.toThrow(
      'invalid date',
    );

    expect(await listPeople(db)).toEqual([]);
  });

  test('happy path - blank optional fields become null and blank lists are skipped', async () => {
    const db = await createTestDb();

    const id = await createPerson(
      db,
      newPerson({
        preferredName: '',
        address: '  ',
        nicknames: ['', ' '],
        interests: [' '],
        notes: ['', '  '],
      }),
      NOW,
    );

    const detail = await getPersonDetail(db, id);
    expect(detail?.preferredName).toBeNull();
    expect(detail?.address).toBeNull();
    expect(detail?.nicknames).toEqual([]);
    expect(detail?.interests).toEqual([]);
    expect(detail?.notes).toEqual([]);
  });
});

describe('listPeople', () => {
  test('happy path - orders by display name ignoring case', async () => {
    const db = await createTestDb();
    await createPerson(db, newPerson({ name: 'Sam Ortiz' }), NOW);
    await createPerson(db, newPerson({ name: 'Margaret Lin', preferredName: 'Maggie' }), NOW);
    await createPerson(db, newPerson({ name: 'priya Nair' }), NOW);

    const people = await listPeople(db);

    expect(people.map((p) => p.name)).toEqual(['Margaret Lin', 'priya Nair', 'Sam Ortiz']);
  });
});

describe('listApiPeople', () => {
  test('happy path - includes nicknames and handles people without any', async () => {
    const db = await createTestDb();
    const maggie = await createPerson(
      db,
      newPerson({ name: 'Margaret Lin', preferredName: 'Maggie', nicknames: ['Mags'], relationship: 'cousin' }),
      NOW,
    );
    const sam = await createPerson(db, newPerson({ name: 'Sam Ortiz' }), NOW);

    const people = await listApiPeople(db);

    expect(people).toEqual([
      { id: maggie, name: 'Margaret Lin', preferred_name: 'Maggie', nicknames: ['Mags'], relationship: 'cousin' },
      { id: sam, name: 'Sam Ortiz', preferred_name: null, nicknames: [], relationship: null },
    ]);
  });
});

describe('updatePerson', () => {
  test('happy path - changes only the patched field', async () => {
    const db = await createTestDb();
    const id = await createPerson(db, newPerson({ address: '12 Elm St' }), NOW);

    await updatePerson(db, id, { phone: '555-0100' }, LATER);

    const detail = await getPersonDetail(db, id);
    expect(detail?.phone).toBe('555-0100');
    expect(detail?.address).toBe('12 Elm St');
    expect(detail?.name).toBe('Priya Nair');
    expect(detail?.createdAt).toBe(NOW.toISOString());
    expect(detail?.updatedAt).toBe(LATER.toISOString());
  });

  test('error - blank name', async () => {
    const db = await createTestDb();
    const id = await createPerson(db, newPerson({}), NOW);

    await expect(updatePerson(db, id, { name: '' }, LATER)).rejects.toThrow('text is required');
  });

  test('error - missing person', async () => {
    const db = await createTestDb();

    await expect(updatePerson(db, 99, { phone: '555-0100' }, LATER)).rejects.toThrow('person not found');
  });
});

describe('deletePerson', () => {
  test('happy path - cascades to every child table and leaves others alone', async () => {
    const db = await createTestDb();
    const gone = await createPerson(
      db,
      newPerson({
        nicknames: ['Pri'],
        interests: ['chess'],
        birthday: { month: 5, day: 9, year: 1990 },
        notes: ['Hello.'],
      }),
      NOW,
    );
    const kept = await createPerson(
      db,
      newPerson({ name: 'Sam Ortiz', nicknames: ['Sammy'], interests: ['chess'], notes: ['Hi.'] }),
      NOW,
    );
    for (const id of [gone, kept]) {
      await db.runAsync(
        "INSERT INTO gift_ideas (person_id, text, source, created_at) VALUES (?, 'book', 'manual', ?)",
        id,
        NOW.toISOString(),
      );
      await db.runAsync(
        "INSERT INTO gifts_given (person_id, text, created_at) VALUES (?, 'scarf', ?)",
        id,
        NOW.toISOString(),
      );
    }

    await deletePerson(db, gone);

    expect(await getPersonDetail(db, gone)).toBeNull();
    for (const table of ['nicknames', 'interests', 'gift_ideas', 'gifts_given', 'dates', 'notes']) {
      expect(await count(db, table, gone)).toBe(0);
    }
    expect(await count(db, 'nicknames', kept)).toBe(1);
    expect(await count(db, 'interests', kept)).toBe(1);
    expect(await count(db, 'gift_ideas', kept)).toBe(1);
    expect(await count(db, 'gifts_given', kept)).toBe(1);
    expect(await count(db, 'notes', kept)).toBe(1);
  });
});

describe('addInterest', () => {
  test('happy path - ignores case-insensitive duplicates for the same person', async () => {
    const db = await createTestDb();
    const a = await createPerson(db, newPerson({}), NOW);
    const b = await createPerson(db, newPerson({ name: 'Sam Ortiz' }), NOW);

    const first = await addInterest(db, a, 'pottery');
    const again = await addInterest(db, a, 'Pottery');
    const other = await addInterest(db, b, 'Pottery');

    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(await count(db, 'interests', a)).toBe(1);
    expect(await count(db, 'interests', b)).toBe(1);
  });

  test('error - blank text', async () => {
    const db = await createTestDb();
    const id = await createPerson(db, newPerson({}), NOW);

    await expect(addInterest(db, id, ' ')).rejects.toThrow('text is required');
  });
});

describe('addNickname', () => {
  test('happy path - ignores case-insensitive duplicates', async () => {
    const db = await createTestDb();
    const id = await createPerson(db, newPerson({}), NOW);

    const first = await addNickname(db, id, 'Pri');
    const again = await addNickname(db, id, 'pri');

    expect(again).toBe(first);
    expect(await count(db, 'nicknames', id)).toBe(1);
  });
});

describe('removeNickname and removeInterest', () => {
  test('happy path - delete one row each', async () => {
    const db = await createTestDb();
    const id = await createPerson(db, newPerson({ nicknames: ['Pri', 'Nair'], interests: ['chess', 'tea'] }), NOW);
    const detail = await getPersonDetail(db, id);

    await removeNickname(db, detail!.nicknames[0].id);
    await removeInterest(db, detail!.interests[0].id);

    const after = await getPersonDetail(db, id);
    expect(after?.nicknames.map((n) => n.text)).toEqual(['Nair']);
    expect(after?.interests.map((i) => i.text)).toEqual(['tea']);
  });
});

describe('getPersonDetail', () => {
  test('happy path - orders notes newest first', async () => {
    const db = await createTestDb();
    const id = await createPerson(db, newPerson({ notes: ['first'] }), NOW);
    await db.runAsync(
      "INSERT INTO notes (person_id, text, created_at) VALUES (?, 'second', ?)",
      id,
      LATER.toISOString(),
    );

    const detail = await getPersonDetail(db, id);

    expect(detail?.notes.map((n) => n.text)).toEqual(['second', 'first']);
  });

  test('error - missing id returns null', async () => {
    const db = await createTestDb();

    expect(await getPersonDetail(db, 42)).toBeNull();
  });
});

describe('listPersonDetails', () => {
  test('happy path - same order as listPeople', async () => {
    const db = await createTestDb();
    await createPerson(db, newPerson({ name: 'Sam Ortiz' }), NOW);
    await createPerson(db, newPerson({ name: 'Margaret Lin', preferredName: 'Maggie' }), NOW);

    const details = await listPersonDetails(db);
    const people = await listPeople(db);

    expect(details.map((d) => d.id)).toEqual(people.map((p) => p.id));
  });
});
