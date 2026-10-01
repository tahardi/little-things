import { addGiftGiven, addGiftIdea, markGiven, removeGiftGiven, removeGiftIdea } from '@/db/gifts';
import { createPerson, getPersonDetail } from '@/db/people';

import { createTestDb } from '../../testing/testDb';

const NOW = new Date('2026-10-01T12:00:00Z');

async function setup() {
  const db = await createTestDb();
  const personId = await createPerson(
    db,
    {
      name: 'Priya Nair',
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
  return { db, personId };
}

describe('addGiftIdea and removeGiftIdea', () => {
  test('happy path - stores text and source, then deletes', async () => {
    const { db, personId } = await setup();

    const id = await addGiftIdea(db, personId, 'clay tools', 'manual', NOW);

    let detail = await getPersonDetail(db, personId);
    expect(detail?.giftIdeas).toEqual([{ id, text: 'clay tools', source: 'manual', createdAt: NOW.toISOString() }]);

    await removeGiftIdea(db, id);

    detail = await getPersonDetail(db, personId);
    expect(detail?.giftIdeas).toEqual([]);
  });
});

describe('markGiven', () => {
  test('happy path - moves the idea to gifts given', async () => {
    const { db, personId } = await setup();
    const id = await addGiftIdea(db, personId, 'clay tools', 'ai', NOW);

    await markGiven(db, id, '2026-10-01', NOW);

    const detail = await getPersonDetail(db, personId);
    expect(detail?.giftIdeas).toEqual([]);
    expect(detail?.giftsGiven).toEqual([
      {
        id: expect.any(Number),
        text: 'clay tools',
        givenOn: '2026-10-01',
        occasion: null,
        createdAt: NOW.toISOString(),
      },
    ]);
  });

  test('error - missing idea throws and changes nothing', async () => {
    const { db, personId } = await setup();
    await addGiftIdea(db, personId, 'clay tools', 'ai', NOW);

    await expect(markGiven(db, 999, '2026-10-01', NOW)).rejects.toThrow('gift idea not found');

    const detail = await getPersonDetail(db, personId);
    expect(detail?.giftIdeas).toHaveLength(1);
    expect(detail?.giftsGiven).toEqual([]);
  });
});

describe('addGiftGiven and removeGiftGiven', () => {
  test('happy path - stores nullable fields, then deletes', async () => {
    const { db, personId } = await setup();

    const full = await addGiftGiven(db, personId, 'concert tickets', '2026-07-23', 'birthday', NOW);
    const bare = await addGiftGiven(db, personId, 'scarf', null, null, NOW);

    let detail = await getPersonDetail(db, personId);
    expect(detail?.giftsGiven.map((g) => [g.text, g.givenOn, g.occasion])).toEqual([
      ['concert tickets', '2026-07-23', 'birthday'],
      ['scarf', null, null],
    ]);

    await removeGiftGiven(db, full);
    await removeGiftGiven(db, bare);

    detail = await getPersonDetail(db, personId);
    expect(detail?.giftsGiven).toEqual([]);
  });
});
