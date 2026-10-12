import { createClip } from '@/db/clips';
import { addDate } from '@/db/dates';
import { addGiftGiven } from '@/db/gifts';
import { createPerson } from '@/db/people';
import { toJson } from '@/export/json';

import { createTestDb } from '../../testing/testDb';

const now = new Date('2026-09-29T12:00:00.000Z');

describe('toJson', () => {
  it('exports every people table and no clips', async () => {
    const db = await createTestDb();
    const id = await createPerson(
      db,
      {
        name: 'Sam "Sammy" Ortiz',
        preferredName: 'Sammy',
        nicknames: ['Sam-O'],
        relationship: 'neighbor',
        birthday: { month: 2, day: 29, year: null },
        address: '4 Oak Lane,\nApt 2',
        phone: '555-0199',
        interests: ['woodworking'],
        notes: ['Moved in next door.'],
      },
      now,
    );
    await addGiftGiven(db, id, 'chisel set', '2025-12-25', 'holidays', now);
    await addDate(db, id, { kind: 'other', label: 'Housewarming', month: 5, day: 1, year: 2026, recurring: false });
    await createClip(db, 'file:///clip.m4a', now);

    const got = JSON.parse(await toJson(db, now));

    expect(Object.keys(got)).toEqual([
      'schema_version',
      'exported_at',
      'people',
      'nicknames',
      'interests',
      'gift_ideas',
      'gifts_given',
      'dates',
      'notes',
    ]);
    expect(got.schema_version).toBe(1);
    expect(got.exported_at).toBe('2026-09-29T12:00:00.000Z');
    expect(got.people[0].name).toBe('Sam "Sammy" Ortiz');
    expect(got.people[0].address).toBe('4 Oak Lane,\nApt 2');
    expect(got.nicknames).toHaveLength(1);
    expect(got.gifts_given).toHaveLength(1);
    expect(got.dates).toHaveLength(2);
    expect(got.notes).toHaveLength(1);
  });
});
