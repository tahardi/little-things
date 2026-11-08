import type { PersonDetail } from '@/db/types';
import { MAX_NOTES, giftsErrorMessage, toGiftsRequest } from '@/gifts/request';

function person(noteCount: number): PersonDetail {
  return {
    id: 1,
    name: 'Margaret Lin',
    preferredName: 'Maggie',
    relationship: 'aunt',
    address: null,
    phone: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nicknames: [{ id: 1, text: 'Mags' }],
    interests: [{ id: 1, text: 'gardening' }],
    giftIdeas: [{ id: 1, text: 'seed catalog', source: 'manual', createdAt: '2026-01-01T00:00:00.000Z' }],
    giftsGiven: [
      { id: 1, text: 'trowel', givenOn: '2025-12-25', occasion: 'holidays', createdAt: '2025-12-25T00:00:00.000Z' },
    ],
    dates: [],
    notes: Array.from({ length: noteCount }, (_, i) => ({
      id: i + 1,
      personId: 1,
      text: `note ${i}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      clipId: null,
    })),
  };
}

describe('toGiftsRequest', () => {
  test('happy path - maps the person and keeps the 50 newest notes', () => {
    // given
    const detail = person(60);

    // when
    const got = toGiftsRequest(detail, '  birthday ');

    // then
    expect(got).toEqual({
      name: 'Margaret Lin',
      preferred_name: 'Maggie',
      relationship: 'aunt',
      interests: ['gardening'],
      gift_ideas: ['seed catalog'],
      gifts_given: ['trowel'],
      notes: detail.notes.slice(0, MAX_NOTES).map((n) => n.text),
      occasion: 'birthday',
    });
    expect(got.notes).toHaveLength(50);
    expect(got.notes[0]).toBe('note 0');
  });

  test('happy path - blank occasion is null', () => {
    // given
    const detail = person(0);

    // when
    const got = toGiftsRequest(detail, '   ');

    // then
    expect(got.occasion).toBeNull();
  });
});

describe('giftsErrorMessage', () => {
  test.each([
    ['unreachable', "Can't reach the backend. Try again when it's on."],
    ['unauthorized', 'The backend key is wrong. Check Settings.'],
    ['upstream_failed', 'The backend had a problem. Try again.'],
    ['bad_request', 'The backend had a problem. Try again.'],
  ] as const)('%s', (code, want) => {
    // given
    // when
    const got = giftsErrorMessage(code);

    // then
    expect(got).toBe(want);
  });
});
