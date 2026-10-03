import { migrate } from '@/db/migrate';

import { createTestDb } from '../../testing/testDb';

const TABLES = ['clips', 'dates', 'gift_ideas', 'gifts_given', 'interests', 'nicknames', 'notes', 'people'];
const NOW = '2026-10-01T12:00:00.000Z';

describe('migrate', () => {
  test('creates every table at version 1', async () => {
    const db = await createTestDb();

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );

    expect(version?.user_version).toBe(1);
    expect(tables.map((t) => t.name)).toEqual(TABLES);
  });

  test('running twice is a no-op', async () => {
    const db = await createTestDb();

    await migrate(db);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(1);
  });

  test('enables foreign keys', async () => {
    const db = await createTestDb();

    const fk = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');

    expect(fk?.foreign_keys).toBe(1);
  });

  test('allows only one birthday per person', async () => {
    const db = await createTestDb();
    await db.runAsync("INSERT INTO people (name, created_at, updated_at) VALUES ('Priya Nair', ?, ?)", NOW, NOW);
    const insert =
      "INSERT INTO dates (person_id, kind, label, month, day, recurring) VALUES (1, 'birthday', 'Birthday', 3, 3, 1)";
    await db.runAsync(insert);

    await expect(db.runAsync(insert)).rejects.toThrow(/UNIQUE/);
  });
});
