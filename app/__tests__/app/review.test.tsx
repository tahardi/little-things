import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Change, NoteResponse } from '@/api/types';
import ReviewScreen from '@/app/review/[clipId]';
import { syncDates } from '@/dates/sync';
import { claimNextQueued, createClip, getClip, markClipReview } from '@/db/clips';
import type { Db } from '@/db/db';
import { DbProvider } from '@/db/DbProvider';
import { createPerson, deletePerson, getPersonDetail } from '@/db/people';
import { deleteClipFile } from '@/processing/audioFiles';
import { createTestDb } from '../../testing/testDb';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: { clipId: string } = { clipId: '0' };

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

jest.mock('@/dates/sync', () => ({
  syncDates: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/processing/audioFiles', () => ({
  deleteClipFile: jest.fn(),
}));

const FILE_URI = 'file:///docs/clips/clip-1.m4a';

function change(overrides: Partial<Change>): Change {
  return {
    type: 'add_interest',
    text: null,
    label: null,
    month: null,
    day: null,
    year: null,
    recurring: null,
    given_on: null,
    occasion: null,
    ...overrides,
  };
}

const result: NoteResponse = {
  transcript: 'Maggie is into pottery. Our anniversary is June 14th. Dave likes fly fishing.',
  matches: [
    {
      person_id: 1,
      note: 'Into pottery.',
      changes: [
        change({ type: 'add_interest', text: 'pottery' }),
        change({ type: 'add_date', label: 'Anniversary', month: 6, day: 14, recurring: true }),
      ],
    },
  ],
  unknown: [{ name: 'Dave', text: 'Likes fly fishing.' }],
  notes: '"Maggie" matched Margaret Lin.',
};

async function seedPerson(db: Db): Promise<number> {
  return createPerson(
    db,
    {
      name: 'Margaret Lin',
      preferredName: null,
      nicknames: ['Maggie'],
      relationship: null,
      birthday: null,
      address: null,
      phone: null,
      interests: [],
      notes: [],
    },
    new Date('2026-01-01T00:00:00Z'),
  );
}

async function seedReviewClip(db: Db): Promise<number> {
  const id = await createClip(db, FILE_URI, new Date('2026-01-02T00:00:00Z'));
  await claimNextQueued(db);
  await markClipReview(db, id, result);
  return id;
}

async function renderScreen(db: Db) {
  await render(
    <DbProvider db={db}>
      <ReviewScreen />
    </DbProvider>,
  );
}

async function save() {
  await fireEvent.press(screen.getByTestId('review-save'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
}

describe('ReviewScreen', () => {
  let db: Db;
  let clipId: number;

  beforeEach(async () => {
    jest.clearAllMocks();
    (syncDates as jest.Mock).mockResolvedValue(undefined);
    (deleteClipFile as jest.Mock).mockImplementation(() => undefined);
    db = await createTestDb();
    await seedPerson(db);
    clipId = await seedReviewClip(db);
    mockParams = { clipId: String(clipId) };
  });

  test('shows the transcript, notes, and matched person', async () => {
    await renderScreen(db);

    expect(await screen.findByTestId('review-transcript')).toHaveTextContent(result.transcript);
    expect(screen.getByTestId('review-notes')).toHaveTextContent('"Maggie" matched Margaret Lin.');
    expect(screen.getByTestId('match-1')).toHaveTextContent('Margaret Lin', { exact: false });
    expect(screen.getByTestId('change-1-0')).toHaveTextContent('Interest: pottery');
    expect(screen.getByTestId('change-1-1')).toHaveTextContent('Anniversary: 6/14 (yearly)');
  });

  test('saves every change by default', async () => {
    await renderScreen(db);
    await screen.findByTestId('review-save');

    await save();

    const detail = await getPersonDetail(db, 1);
    expect(detail?.interests.map((i) => i.text)).toEqual(['pottery']);
    expect(detail?.dates).toEqual([
      expect.objectContaining({ label: 'Anniversary', month: 6, day: 14, recurring: true }),
    ]);
    expect(detail?.notes).toEqual([expect.objectContaining({ text: 'Into pottery.', clipId })]);
    expect((await getClip(db, clipId))?.status).toBe('done');
    expect(deleteClipFile).toHaveBeenCalledWith(FILE_URI);
    expect(syncDates).toHaveBeenCalledTimes(1);
  });

  test('skips a change toggled off', async () => {
    await renderScreen(db);
    await fireEvent(await screen.findByTestId('change-toggle-1-0'), 'valueChange', false);

    await save();

    const detail = await getPersonDetail(db, 1);
    expect(detail?.interests).toEqual([]);
    expect(detail?.dates).toHaveLength(1);
    expect(detail?.notes).toHaveLength(1);
  });

  test('saves edited change text', async () => {
    await renderScreen(db);
    await fireEvent.changeText(await screen.findByTestId('change-edit-1-0'), 'wheel pottery');

    expect(screen.getByTestId('change-1-0')).toHaveTextContent('Interest: wheel pottery');
    await save();

    expect((await getPersonDetail(db, 1))?.interests.map((i) => i.text)).toEqual(['wheel pottery']);
  });

  test('does not offer text editing for dates', async () => {
    await renderScreen(db);
    await screen.findByTestId('change-1-1');

    expect(screen.queryByTestId('change-edit-1-1')).toBeNull();
  });

  test('changes no person data before save', async () => {
    const before = await getPersonDetail(db, 1);
    await renderScreen(db);
    await fireEvent(await screen.findByTestId('change-toggle-1-1'), 'valueChange', false);
    await fireEvent.changeText(screen.getByTestId('change-edit-1-0'), 'wheel pottery');
    await fireEvent.changeText(screen.getByTestId('note-input-1'), 'Edited note.');

    expect(await getPersonDetail(db, 1)).toEqual(before);
    expect((await getClip(db, clipId))?.status).toBe('review');
  });

  test('saves nothing for a cleared note with every change off', async () => {
    const before = await getPersonDetail(db, 1);
    await renderScreen(db);
    await fireEvent.changeText(await screen.findByTestId('note-input-1'), '');
    await fireEvent(screen.getByTestId('change-toggle-1-0'), 'valueChange', false);
    await fireEvent(screen.getByTestId('change-toggle-1-1'), 'valueChange', false);

    await save();

    expect(await getPersonDetail(db, 1)).toEqual(before);
    expect((await getClip(db, clipId))?.status).toBe('done');
  });

  test('links unknown names to Add Person without creating people', async () => {
    await renderScreen(db);

    const unknown = await screen.findByTestId('unknown-0');
    expect(unknown).toHaveTextContent('Dave', { exact: false });
    expect(unknown).toHaveTextContent('Likes fly fishing.', { exact: false });
    await fireEvent.press(screen.getByTestId('add-person-0'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/person/new', params: { name: 'Dave' } });
    expect(await getPersonDetail(db, 2)).toBeNull();
  });

  test('saves the clip when the matched person was deleted', async () => {
    await deletePerson(db, 1);
    await renderScreen(db);

    expect(await screen.findByTestId('match-1')).toHaveTextContent('Person no longer exists');
    expect(screen.queryByTestId('note-input-1')).toBeNull();
    await save();

    expect((await getClip(db, clipId))?.status).toBe('done');
  });

  test('shows nothing to review for a queued clip', async () => {
    const queuedId = await createClip(db, 'file:///docs/clips/clip-2.m4a', new Date('2026-01-03T00:00:00Z'));
    mockParams = { clipId: String(queuedId) };
    await renderScreen(db);

    expect(await screen.findByTestId('review-empty')).toHaveTextContent('Nothing to review');
    await fireEvent.press(screen.getByTestId('home-button'));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  test('still syncs and navigates when deleting the audio file fails', async () => {
    (deleteClipFile as jest.Mock).mockImplementation(() => {
      throw new Error('disk error');
    });
    await renderScreen(db);
    await screen.findByTestId('review-save');

    await save();

    expect(syncDates).toHaveBeenCalledTimes(1);
    expect((await getClip(db, clipId))?.status).toBe('done');
  });
});
