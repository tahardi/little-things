import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { syncDates } from '@/dates/sync';

import { resetProcessingClips } from './clips';
import { type Db, openDb } from './db';

const DbContext = createContext<Db | null>(null);

export function DbProvider({ db, children }: { db?: Db; children: ReactNode }) {
  const [opened, setOpened] = useState<Db | null>(db ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (db) {
      return;
    }
    let cancelled = false;
    (async () => {
      const d = await openDb();
      await resetProcessingClips(d);
      await syncDates(d).catch((e: unknown) => console.warn('syncing dates failed', e));
      if (!cancelled) {
        setOpened(d);
      }
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (error) {
    return <Text testID="db-error">Could not open the database: {error}</Text>;
  }
  if (!opened) {
    return null;
  }
  return <DbContext.Provider value={opened}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error('useDb must be used inside DbProvider');
  }
  return db;
}
