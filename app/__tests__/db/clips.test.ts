import fs from 'fs';
import path from 'path';

import type { NoteResponse } from '@/api/types';
import {
  claimNextQueued,
  createClip,
  getClip,
  listOpenClips,
  markClipDone,
  markClipError,
  markClipReview,
  resetProcessingClips,
} from '@/db/clips';
import type { Db } from '@/db/db';

import { createTestDb } from '../../testing/testDb';

const NOW = new Date('2026-10-01T12:00:00Z');
const FIXTURE = path.join(__dirname, '../../../api/testdata', 'note-response.json');

function loadResult(): NoteResponse {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as NoteResponse;
}

async function finish(db: Db, id: number): Promise<void> {
  await claimNextQueued(db);
  await markClipReview(db, id, loadResult());
  await markClipDone(db, id);
}

function at(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

describe('createClip', () => {
  test('happy path - stores a queued clip', async () => {
    const db = await createTestDb();

    const id = await createClip(db, 'file:///a.m4a', NOW);

    expect(await getClip(db, id)).toEqual({
      id,
      fileUri: 'file:///a.m4a',
      status: 'queued',
      error: null,
      result: null,
      createdAt: NOW.toISOString(),
    });
  });
});

describe('listOpenClips', () => {
  test('happy path - excludes done and orders oldest first', async () => {
    const db = await createTestDb();
    const finished = await createClip(db, 'file:///4.m4a', at(-1));
    await finish(db, finished);
    const third = await createClip(db, 'file:///3.m4a', at(2));
    const first = await createClip(db, 'file:///1.m4a', at(0));
    const second = await createClip(db, 'file:///2.m4a', at(1));

    const clips = await listOpenClips(db);

    expect(clips.map((c) => c.id)).toEqual([first, second, third]);
  });
});

describe('claimNextQueued', () => {
  test('happy path - claims the oldest queued clip and clears the error', async () => {
    const db = await createTestDb();
    const newer = await createClip(db, 'file:///new.m4a', at(5));
    const older = await createClip(db, 'file:///old.m4a', at(0));
    await db.runAsync("UPDATE clips SET error = 'boom' WHERE id = ?", older);

    const claimed = await claimNextQueued(db);

    expect(claimed).toMatchObject({ id: older, status: 'processing', error: null });
    expect((await getClip(db, newer))?.status).toBe('queued');
  });

  test('happy path - returns null when nothing is queued', async () => {
    const db = await createTestDb();

    expect(await claimNextQueued(db)).toBeNull();
  });

  test('happy path - concurrent claims return exactly one clip', async () => {
    const db = await createTestDb();
    await createClip(db, 'file:///a.m4a', NOW);

    const results = await Promise.all([claimNextQueued(db), claimNextQueued(db)]);

    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(1);
  });
});

describe('markClipReview', () => {
  test('happy path - stores the result on a processing clip', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', NOW);
    await claimNextQueued(db);
    const result = loadResult();

    await markClipReview(db, id, result);

    const clip = await getClip(db, id);
    expect(clip?.status).toBe('review');
    expect(clip?.result).toEqual(result);
  });

  test('happy path - stale call on a queued clip changes nothing', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', NOW);

    await markClipReview(db, id, loadResult());

    const clip = await getClip(db, id);
    expect(clip?.status).toBe('queued');
    expect(clip?.result).toBeNull();
  });
});

describe('markClipError', () => {
  test('happy path - moves processing back to queued with the message', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', NOW);
    await claimNextQueued(db);

    await markClipError(db, id, 'upstream failed');

    expect(await getClip(db, id)).toMatchObject({ status: 'queued', error: 'upstream failed' });
  });

  test('happy path - stale call on a review clip changes nothing', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', NOW);
    await claimNextQueued(db);
    await markClipReview(db, id, loadResult());

    await markClipError(db, id, 'late failure');

    expect(await getClip(db, id)).toMatchObject({ status: 'review', error: null });
  });
});

describe('resetProcessingClips', () => {
  test('happy path - requeues processing clips and leaves review clips alone', async () => {
    const db = await createTestDb();
    const reviewing = await createClip(db, 'file:///1.m4a', at(0));
    const processing = await createClip(db, 'file:///2.m4a', at(1));
    await claimNextQueued(db);
    await markClipReview(db, reviewing, loadResult());
    await claimNextQueued(db);

    await resetProcessingClips(db);

    expect((await getClip(db, reviewing))?.status).toBe('review');
    expect((await getClip(db, processing))?.status).toBe('queued');
  });
});

describe('markClipDone', () => {
  test('happy path - sets done on a review clip', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', NOW);
    await claimNextQueued(db);
    await markClipReview(db, id, loadResult());

    await markClipDone(db, id);

    expect((await getClip(db, id))?.status).toBe('done');
  });

  test('happy path - stale call on a queued clip changes nothing', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', NOW);

    await markClipDone(db, id);

    expect((await getClip(db, id))?.status).toBe('queued');
  });
});
