import Database from 'better-sqlite3';

import type { BindValue, Db } from '@/db/db';
import { migrate } from '@/db/migrate';

export async function createTestDb(): Promise<Db> {
  const raw = new Database(':memory:');
  const db: Db = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...params: BindValue[]) {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async getFirstAsync<T>(sql: string, ...params: BindValue[]) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: BindValue[]) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async withExclusiveTransactionAsync(task: (txn: Db) => Promise<void>) {
      raw.exec('BEGIN EXCLUSIVE');
      try {
        await task(db);
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  await migrate(db);
  return db;
}
