import { requireText } from './clean';
import type { Db } from './db';

export async function addNote(
  db: Db,
  personId: number,
  text: string,
  now: Date,
  clipId: number | null,
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO notes (person_id, text, created_at, clip_id) VALUES (?, ?, ?, ?)',
    personId,
    requireText(text),
    now.toISOString(),
    clipId,
  );
  return r.lastInsertRowId;
}
