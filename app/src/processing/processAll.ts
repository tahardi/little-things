import { ApiError, type Client } from '@/api/client';
import { claimNextQueued, markClipError, markClipReview, resetProcessingClips } from '@/db/clips';
import { listApiPeople } from '@/db/people';
import type { Db } from '@/db/db';
import type { Clip } from '@/db/types';

export type ProcessDeps = { db: Db; client: Client };
export type ProcessSummary = { processed: number; failed: number };

let inFlight: Promise<ProcessSummary> | null = null;

export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Backend error';
  }
  switch (error.code) {
    case 'unreachable':
      return "Can't reach backend";
    case 'unauthorized':
      return 'Wrong key';
    case 'no_speech':
      return 'No speech found in the recording';
    case 'payload_too_large':
      return 'Recording is too large';
    default:
      return 'Backend error';
  }
}

export function processAll(deps: ProcessDeps): Promise<ProcessSummary> {
  if (!inFlight) {
    inFlight = run(deps).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function currentRun(): Promise<ProcessSummary> | null {
  return inFlight;
}

export async function processIfReachable(deps: ProcessDeps): Promise<ProcessSummary | null> {
  try {
    await deps.client.health();
  } catch {
    return null;
  }
  return processAll(deps);
}

async function run({ db, client }: ProcessDeps): Promise<ProcessSummary> {
  await resetProcessingClips(db);
  const claimed: Clip[] = [];
  for (let clip = await claimNextQueued(db); clip; clip = await claimNextQueued(db)) {
    claimed.push(clip);
  }
  const people = await listApiPeople(db);
  let processed = 0;
  let failed = 0;
  for (const clip of claimed) {
    try {
      const result = await client.note(clip.fileUri, people);
      await markClipReview(db, clip.id, result);
      processed += 1;
    } catch (error) {
      await markClipError(db, clip.id, messageFor(error));
      failed += 1;
    }
  }
  return { processed, failed };
}
