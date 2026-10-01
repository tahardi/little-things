import type { Change, ChangeType, NoteResponse } from '@/api/types';
import { claimNextQueued, createClip, getClip, markClipReview } from '@/db/clips';
import type { Db } from '@/db/db';
import { createPerson, deletePerson, getPersonDetail } from '@/db/people';
import { applyReview } from '@/db/review';
import type { PersonDetail } from '@/db/types';

import { createTestDb } from '../../testing/testDb';

const NOW = new Date('2026-10-01T12:00:00Z');
const EMPTY: NoteResponse = { transcript: '', matches: [], unknown: [], notes: '' };

function change(type: ChangeType, fields: Partial<Change>): Change {
  return {
    type,
    text: null,
    label: null,
    month: null,
    day: null,
    year: null,
    recurring: null,
    given_on: null,
    occasion: null,
    ...fields,
  };
}

async function addPerson(db: Db, name: string): Promise<number> {
  return createPerson(
    db,
    {
      name,
      preferredName: null,
      nicknames: [],
      relationship: null,
      birthday: null,
      address: null,
      phone: null,
      interests: [],
      notes: [],
    },
    NOW,
  );
}

async function setup(): Promise<{ db: Db; personId: number; clipId: number }> {
  const db = await createTestDb();
  const personId = await addPerson(db, 'Margaret Lin');
  const clipId = await createClip(db, 'file:///clip-1.m4a', NOW);
  await claimNextQueued(db);
  await markClipReview(db, clipId, EMPTY);
  return { db, personId, clipId };
}

describe('applyReview', () => {
  test.each<[string, Change, (d: PersonDetail) => unknown, unknown]>([
    ['add_interest', change('add_interest', { text: 'pottery' }), (d) => d.interests.map((i) => i.text), ['pottery']],
    [
      'add_gift_idea',
      change('add_gift_idea', { text: 'clay tools' }),
      (d) => d.giftIdeas.map((g) => [g.text, g.source]),
      [['clay tools', 'voice']],
    ],
    [
      'add_gift_given',
      change('add_gift_given', { text: 'concert tickets', given_on: '2026-07-23', occasion: 'birthday' }),
      (d) => d.giftsGiven.map((g) => [g.text, g.givenOn, g.occasion]),
      [['concert tickets', '2026-07-23', 'birthday']],
    ],
    [
      'set_birthday',
      change('set_birthday', { month: 3, day: 3 }),
      (d) => d.dates.map((x) => [x.kind, x.month, x.day, x.year]),
      [['birthday', 3, 3, null]],
    ],
    [
      'add_date',
      change('add_date', { label: 'Anniversary', month: 6, day: 14, year: 2019, recurring: true }),
      (d) => d.dates.map((x) => [x.kind, x.label, x.month, x.day, x.year, x.recurring]),
      [['other', 'Anniversary', 6, 14, 2019, true]],
    ],
    ['set_address', change('set_address', { text: '12 Elm St' }), (d) => d.address, '12 Elm St'],
    ['set_phone', change('set_phone', { text: '555-0100' }), (d) => d.phone, '555-0100'],
    ['set_relationship', change('set_relationship', { text: 'cousin' }), (d) => d.relationship, 'cousin'],
    ['set_preferred_name', change('set_preferred_name', { text: 'Maggie' }), (d) => d.preferredName, 'Maggie'],
    ['add_nickname', change('add_nickname', { text: 'Mags' }), (d) => d.nicknames.map((n) => n.text), ['Mags']],
  ])('applies %s', async (_name, c, pick, want) => {
    // given
    const { db, personId, clipId } = await setup();

    // when
    await applyReview(db, clipId, [{ personId, note: 'Heard today.', changes: [c] }], NOW);

    // then
    const detail = await getPersonDetail(db, personId);
    expect(pick(detail as PersonDetail)).toEqual(want);
    expect(detail?.notes.map((n) => [n.text, n.clipId])).toEqual([['Heard today.', clipId]]);
    expect((await getClip(db, clipId))?.status).toBe('done');
  });

  test.each<[string, Change]>([
    ['add_interest without text', change('add_interest', { text: ' ' })],
    ['set_birthday without day', change('set_birthday', { month: 3 })],
    ['set_birthday on Feb 30', change('set_birthday', { month: 2, day: 30 })],
    ['add_date without label', change('add_date', { month: 6, day: 14, recurring: true })],
    ['add_date without recurring', change('add_date', { label: 'Anniversary', month: 6, day: 14 })],
  ])('skips %s and applies the rest', async (_name, bad) => {
    // given
    const { db, personId, clipId } = await setup();

    // when
    await applyReview(
      db,
      clipId,
      [{ personId, note: '', changes: [bad, change('add_interest', { text: 'swimming' })] }],
      NOW,
    );

    // then
    const detail = await getPersonDetail(db, personId);
    expect(detail?.interests.map((i) => i.text)).toEqual(['swimming']);
    expect(detail?.dates).toEqual([]);
    expect(detail?.notes).toEqual([]);
  });

  test('skips a person deleted while the clip waited in review', async () => {
    // given
    const { db, personId, clipId } = await setup();
    const otherId = await addPerson(db, 'Sam Ortiz');
    await deletePerson(db, personId);

    // when
    await applyReview(
      db,
      clipId,
      [
        { personId, note: 'Gone.', changes: [change('add_interest', { text: 'pottery' })] },
        { personId: otherId, note: 'Likes hiking.', changes: [change('add_interest', { text: 'hiking' })] },
      ],
      NOW,
    );

    // then
    const other = await getPersonDetail(db, otherId);
    expect(other?.interests.map((i) => i.text)).toEqual(['hiking']);
    expect((await getClip(db, clipId))?.status).toBe('done');
  });

  test('throws when the clip is not in review', async () => {
    // given
    const { db, personId } = await setup();
    const queuedId = await createClip(db, 'file:///clip-2.m4a', NOW);

    // when
    const result = applyReview(db, queuedId, [{ personId, note: 'x', changes: [] }], NOW);

    // then
    await expect(result).rejects.toThrow('clip is not in review');
  });

  test('rolls back everything when a write fails', async () => {
    // given
    const { db, personId, clipId } = await setup();
    await db.execAsync('DROP TABLE gift_ideas');

    // when
    const result = applyReview(
      db,
      clipId,
      [
        {
          personId,
          note: 'Partial.',
          changes: [change('add_interest', { text: 'pottery' }), change('add_gift_idea', { text: 'clay' })],
        },
      ],
      NOW,
    );

    // then
    await expect(result).rejects.toThrow();
    const interests = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM interests');
    expect(interests?.n).toBe(0);
    expect((await getClip(db, clipId))?.status).toBe('review');
  });
});
