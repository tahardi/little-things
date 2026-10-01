import { openDatabaseAsync } from 'expo-sqlite';

import { migrate } from './migrate';

export type BindValue = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: BindValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, ...params: BindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: BindValue[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (txn: Db) => Promise<void>): Promise<void>;
}

export async function openDb(): Promise<Db> {
  const db = await openDatabaseAsync('littlethings.db');
  await migrate(db);
  return db;
}
