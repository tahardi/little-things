import type { Db } from './db';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE people (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    preferred_name TEXT,
    relationship TEXT,
    address TEXT,
    phone TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE nicknames (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    text TEXT NOT NULL COLLATE NOCASE,
    UNIQUE (person_id, text)
  );

  CREATE TABLE interests (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    text TEXT NOT NULL COLLATE NOCASE,
    created_at TEXT NOT NULL,
    UNIQUE (person_id, text)
  );

  CREATE TABLE gift_ideas (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('voice', 'ai', 'manual')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE gifts_given (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    given_on TEXT,
    occasion TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE dates (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('birthday', 'other')),
    label TEXT NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
    year INTEGER,
    recurring INTEGER NOT NULL CHECK (recurring IN (0, 1)),
    calendar_event_id TEXT
  );

  CREATE UNIQUE INDEX dates_one_birthday ON dates (person_id) WHERE kind = 'birthday';

  CREATE TABLE clips (
    id INTEGER PRIMARY KEY,
    file_uri TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'review', 'done')),
    error TEXT,
    result TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    clip_id INTEGER REFERENCES clips(id) ON DELETE SET NULL
  );
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
      await txn.execAsync(`PRAGMA user_version = ${next}`);
    });
  }
}
