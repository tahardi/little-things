import type { Db } from '@/db/db';

const TABLES = ['people', 'nicknames', 'interests', 'gift_ideas', 'gifts_given', 'dates', 'notes'];

export async function toJson(db: Db, now: Date): Promise<string> {
  const data: Record<string, unknown> = { schema_version: 1, exported_at: now.toISOString() };
  for (const table of TABLES) {
    data[table] = await db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`);
  }
  return JSON.stringify(data, null, 2);
}
