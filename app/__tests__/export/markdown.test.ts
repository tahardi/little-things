import type { PersonDetail } from '@/db/types';
import { toMarkdown } from '@/export/markdown';

const createdAt = '2026-09-29T12:00:00.000Z';

function person(overrides: Partial<PersonDetail> = {}): PersonDetail {
  return {
    id: 1,
    name: 'Margaret Lin',
    preferredName: null,
    relationship: null,
    address: null,
    phone: null,
    createdAt,
    updatedAt: createdAt,
    nicknames: [],
    interests: [],
    giftIdeas: [],
    giftsGiven: [],
    dates: [],
    notes: [],
    ...overrides,
  };
}

const full = person({
  preferredName: 'Maggie',
  relationship: 'college friend',
  address: '12 Elm Street, Springfield',
  phone: '555-0142',
  nicknames: [
    { id: 1, text: 'Mags' },
    { id: 2, text: 'Magpie' },
  ],
  interests: [
    { id: 1, text: 'pottery' },
    { id: 2, text: 'trail running' },
  ],
  giftIdeas: [{ id: 1, text: 'glazing kit', source: 'voice', createdAt }],
  giftsGiven: [
    { id: 1, text: 'concert tickets', givenOn: '2026-07-23', occasion: 'birthday', createdAt },
    { id: 2, text: 'scarf', givenOn: '2025-12-25', occasion: null, createdAt },
    { id: 3, text: 'bookmark', givenOn: null, occasion: null, createdAt },
  ],
  dates: [
    {
      id: 1,
      personId: 1,
      kind: 'birthday',
      label: 'Birthday',
      month: 3,
      day: 7,
      year: 1988,
      recurring: true,
      calendarEventId: null,
    },
    {
      id: 2,
      personId: 1,
      kind: 'other',
      label: 'Anniversary',
      month: 6,
      day: 14,
      year: null,
      recurring: true,
      calendarEventId: null,
    },
    {
      id: 3,
      personId: 1,
      kind: 'other',
      label: 'Surgery',
      month: 11,
      day: 2,
      year: 2026,
      recurring: false,
      calendarEventId: null,
    },
  ],
  notes: [{ id: 1, personId: 1, text: 'Getting into pottery.', createdAt, clipId: null }],
});

describe('toMarkdown', () => {
  it('writes every field and section in the People note format', () => {
    expect(toMarkdown([full])).toBe(
      [
        '## Margaret Lin',
        '**Birthday** 03/07/1988',
        '**Address** 12 Elm Street, Springfield',
        '**Phone** 555-0142',
        '**Preferred Name** Maggie',
        '**Nicknames** Mags, Magpie',
        '**Relationship** college friend',
        '',
        '#### Info & Interests',
        '- pottery',
        '- trail running',
        '',
        '#### Presents',
        '- glazing kit',
        '',
        '#### Gifts Given',
        '- concert tickets (2026-07-23, birthday)',
        '- scarf (2025-12-25)',
        '- bookmark',
        '',
        '#### Dates',
        '- Anniversary: 06/14 (yearly)',
        '- Surgery: 11/02/2026',
        '',
        '#### Notes',
        '- 2026-09-29: Getting into pottery.',
        '',
      ].join('\n'),
    );
  });

  it('writes bare labels and headings for an empty person', () => {
    expect(toMarkdown([person({ name: 'Priya Nair' })])).toBe(
      [
        '## Priya Nair',
        '**Birthday**',
        '**Address**',
        '**Phone**',
        '**Preferred Name**',
        '**Nicknames**',
        '**Relationship**',
        '',
        '#### Info & Interests',
        '',
        '#### Presents',
        '',
        '#### Gifts Given',
        '',
        '#### Dates',
        '',
        '#### Notes',
        '',
      ].join('\n'),
    );
  });

  it('writes a birthday without a year as month and day', () => {
    const p = person({
      dates: [
        {
          id: 1,
          personId: 1,
          kind: 'birthday',
          label: 'Birthday',
          month: 10,
          day: 11,
          year: null,
          recurring: true,
          calendarEventId: null,
        },
      ],
    });

    expect(toMarkdown([p])).toContain('**Birthday** 10/11\n');
  });

  it('sorts people by name ignoring case and separates them with a blank line', () => {
    const got = toMarkdown([
      person({ name: 'Sam Ortiz' }),
      person({ name: 'priya Nair' }),
      person({ name: 'Margaret Lin' }),
    ]);

    const headers = got.split('\n').filter((l) => l.startsWith('## '));
    expect(headers).toEqual(['## Margaret Lin', '## priya Nair', '## Sam Ortiz']);
    expect(got).toContain('#### Notes\n\n## priya Nair\n');
  });

  it('keeps quotes and markdown characters and flattens newlines', () => {
    const p = person({
      name: 'Sam "Sammy" Ortiz',
      notes: [{ id: 1, personId: 1, text: 'Loves "jazz", *vinyl*\nand #records', createdAt, clipId: null }],
    });

    const got = toMarkdown([p]);

    expect(got).toContain('## Sam "Sammy" Ortiz\n');
    expect(got).toContain('- 2026-09-29: Loves "jazz", *vinyl* and #records\n');
  });

  it('returns an empty string for no people', () => {
    expect(toMarkdown([])).toBe('');
  });
});
