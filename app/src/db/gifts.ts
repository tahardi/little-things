import { clean, requireText } from './clean';
import type { Db } from './db';

export async function addGiftIdea(
  db: Db,
  personId: number,
  text: string,
  source: 'voice' | 'ai' | 'manual',
  now: Date,
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO gift_ideas (person_id, text, source, created_at) VALUES (?, ?, ?, ?)',
    personId,
    requireText(text),
    source,
    now.toISOString(),
  );
  return r.lastInsertRowId;
}

export async function removeGiftIdea(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM gift_ideas WHERE id = ?', id);
}

export async function addGiftGiven(
  db: Db,
  personId: number,
  text: string,
  givenOn: string | null,
  occasion: string | null,
  now: Date,
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO gifts_given (person_id, text, given_on, occasion, created_at) VALUES (?, ?, ?, ?, ?)',
    personId,
    requireText(text),
    clean(givenOn),
    clean(occasion),
    now.toISOString(),
  );
  return r.lastInsertRowId;
}

export async function removeGiftGiven(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM gifts_given WHERE id = ?', id);
}

export async function markGiven(db: Db, ideaId: number, today: string, now: Date): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const idea = await txn.getFirstAsync<{ person_id: number; text: string }>(
      'SELECT person_id, text FROM gift_ideas WHERE id = ?',
      ideaId,
    );
    if (!idea) {
      throw new Error('gift idea not found');
    }
    await addGiftGiven(txn, idea.person_id, idea.text, today, null, now);
    await removeGiftIdea(txn, ideaId);
  });
}
