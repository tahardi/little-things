import type { NoteResponse } from '@/api/types';

import type { Db } from './db';
import type { Clip, ClipStatus } from './types';

type ClipRow = {
  id: number;
  file_uri: string;
  status: ClipStatus;
  error: string | null;
  result: string | null;
  created_at: string;
};

function toClip(r: ClipRow): Clip {
  return {
    id: r.id,
    fileUri: r.file_uri,
    status: r.status,
    error: r.error,
    result: r.result === null ? null : (JSON.parse(r.result) as NoteResponse),
    createdAt: r.created_at,
  };
}

export async function createClip(db: Db, fileUri: string, now: Date): Promise<number> {
  const r = await db.runAsync(
    "INSERT INTO clips (file_uri, status, created_at) VALUES (?, 'queued', ?)",
    fileUri,
    now.toISOString(),
  );
  return r.lastInsertRowId;
}

export async function listOpenClips(db: Db): Promise<Clip[]> {
  const rows = await db.getAllAsync<ClipRow>("SELECT * FROM clips WHERE status != 'done' ORDER BY created_at, id");
  return rows.map(toClip);
}

export async function getClip(db: Db, id: number): Promise<Clip | null> {
  const row = await db.getFirstAsync<ClipRow>('SELECT * FROM clips WHERE id = ?', id);
  return row ? toClip(row) : null;
}

export async function claimNextQueued(db: Db): Promise<Clip | null> {
  const row = await db.getFirstAsync<ClipRow>(
    `UPDATE clips SET status = 'processing', error = NULL
     WHERE id = (SELECT id FROM clips WHERE status = 'queued' ORDER BY created_at, id LIMIT 1)
     RETURNING *`,
  );
  return row ? toClip(row) : null;
}

export async function markClipReview(db: Db, id: number, result: NoteResponse): Promise<void> {
  await db.runAsync(
    "UPDATE clips SET status = 'review', result = ?, error = NULL WHERE id = ? AND status = 'processing'",
    JSON.stringify(result),
    id,
  );
}

export async function markClipError(db: Db, id: number, message: string): Promise<void> {
  await db.runAsync(
    "UPDATE clips SET status = 'queued', error = ? WHERE id = ? AND status = 'processing'",
    message,
    id,
  );
}

export async function resetProcessingClips(db: Db): Promise<void> {
  await db.runAsync("UPDATE clips SET status = 'queued' WHERE status = 'processing'");
}

export async function markClipDone(db: Db, id: number): Promise<void> {
  await db.runAsync("UPDATE clips SET status = 'done' WHERE id = ? AND status = 'review'", id);
}
