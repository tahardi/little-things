import { createTestDb } from '../../testing/testDb';
import { createPerson } from '@/db/people';
import { claimNextQueued, createClip, getClip } from '@/db/clips';
import { ApiError, type Client } from '@/api/client';
import type { NoteResponse } from '@/api/types';
import type { Db } from '@/db/db';
import { messageFor, processAll, processIfReachable } from '@/processing/processAll';

const now = new Date('2026-09-29T12:00:00Z');

function response(personId: number): NoteResponse {
  return {
    transcript: 'Maggie likes pottery',
    matches: [{ person_id: personId, note: 'Likes pottery.', changes: [] }],
    unknown: [],
    notes: '',
  };
}

function fakeClient(overrides: Partial<Client>): Client {
  return {
    health: jest.fn().mockResolvedValue({ status: 'ok' }),
    field: jest.fn(),
    note: jest.fn(),
    gifts: jest.fn(),
    ...overrides,
  };
}

async function seedPerson(db: Db): Promise<number> {
  return createPerson(
    db,
    {
      name: 'Margaret Lin',
      preferredName: null,
      nicknames: ['Maggie'],
      relationship: 'college friend',
      birthday: null,
      address: null,
      phone: null,
      interests: [],
      notes: [],
    },
    now,
  );
}

describe('processAll', () => {
  test('moves every queued clip to review and sends the people list', async () => {
    const db = await createTestDb();
    const personId = await seedPerson(db);
    const a = await createClip(db, 'file:///a.m4a', now);
    const b = await createClip(db, 'file:///b.m4a', now);
    const note = jest.fn().mockResolvedValue(response(personId));

    const summary = await processAll({ db, client: fakeClient({ note }) });

    expect(summary).toEqual({ processed: 2, failed: 0 });
    expect((await getClip(db, a))?.status).toBe('review');
    expect((await getClip(db, b))?.result).toEqual(response(personId));
    expect(note).toHaveBeenCalledWith('file:///a.m4a', [
      {
        id: personId,
        name: 'Margaret Lin',
        preferred_name: null,
        nicknames: ['Maggie'],
        relationship: 'college friend',
      },
    ]);
  });

  test('keeps a failed clip queued with its message and continues', async () => {
    const db = await createTestDb();
    const personId = await seedPerson(db);
    const a = await createClip(db, 'file:///a.m4a', now);
    const b = await createClip(db, 'file:///b.m4a', now);
    const note = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('unreachable', null, 'network'))
      .mockResolvedValueOnce(response(personId));

    const summary = await processAll({ db, client: fakeClient({ note }) });

    expect(summary).toEqual({ processed: 1, failed: 1 });
    expect(await getClip(db, a)).toMatchObject({ status: 'queued', error: "Can't reach backend" });
    expect((await getClip(db, b))?.status).toBe('review');
    expect(note).toHaveBeenCalledTimes(2);
  });

  test('never sends clips that are not queued', async () => {
    const db = await createTestDb();
    const personId = await seedPerson(db);
    const a = await createClip(db, 'file:///a.m4a', now);
    const note = jest.fn().mockResolvedValue(response(personId));
    await processAll({ db, client: fakeClient({ note }) });
    note.mockClear();

    const summary = await processAll({ db, client: fakeClient({ note }) });

    expect(summary).toEqual({ processed: 0, failed: 0 });
    expect(note).not.toHaveBeenCalled();
    expect((await getClip(db, a))?.status).toBe('review');
  });

  test('concurrent calls share one run and send each clip once', async () => {
    const db = await createTestDb();
    const personId = await seedPerson(db);
    await createClip(db, 'file:///a.m4a', now);
    let release: (value: NoteResponse) => void = () => {};
    const note = jest.fn().mockImplementation(
      () =>
        new Promise<NoteResponse>((resolve) => {
          release = resolve;
        }),
    );
    const client = fakeClient({ note });

    const first = processAll({ db, client });
    const second = processAll({ db, client });
    await new Promise((resolve) => setTimeout(resolve, 0));
    release(response(personId));

    expect(second).toBe(first);
    expect(await first).toEqual({ processed: 1, failed: 0 });
    expect(note).toHaveBeenCalledTimes(1);
  });

  test('resets a clip left in processing and sends it', async () => {
    const db = await createTestDb();
    const personId = await seedPerson(db);
    const a = await createClip(db, 'file:///a.m4a', now);
    await claimNextQueued(db);
    const note = jest.fn().mockResolvedValue(response(personId));

    const summary = await processAll({ db, client: fakeClient({ note }) });

    expect(summary).toEqual({ processed: 1, failed: 0 });
    expect((await getClip(db, a))?.status).toBe('review');
  });
});

describe('messageFor', () => {
  test.each([
    [new ApiError('unreachable', null, 'x'), "Can't reach backend"],
    [new ApiError('unauthorized', 401, 'x'), 'Wrong key'],
    [new ApiError('no_speech', 422, 'x'), 'No speech found in the recording'],
    [new ApiError('payload_too_large', 413, 'x'), 'Recording is too large'],
    [new ApiError('upstream_failed', 502, 'x'), 'Backend error'],
    [new Error('boom'), 'Backend error'],
  ])('%p maps to %p', (error, want) => {
    expect(messageFor(error)).toBe(want);
  });
});

describe('processIfReachable', () => {
  test('sends nothing when health fails', async () => {
    const db = await createTestDb();
    await createClip(db, 'file:///a.m4a', now);
    const note = jest.fn();
    const health = jest.fn().mockRejectedValue(new ApiError('unreachable', null, 'x'));

    const summary = await processIfReachable({ db, client: fakeClient({ health, note }) });

    expect(summary).toBeNull();
    expect(note).not.toHaveBeenCalled();
  });

  test('processes when health succeeds', async () => {
    const db = await createTestDb();
    const personId = await seedPerson(db);
    await createClip(db, 'file:///a.m4a', now);
    const note = jest.fn().mockResolvedValue(response(personId));

    const summary = await processIfReachable({ db, client: fakeClient({ note }) });

    expect(summary).toEqual({ processed: 1, failed: 0 });
  });
});
