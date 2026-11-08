import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { ApiError, createClient } from '@/api/client';
import GiftIdeasScreen from '@/app/person/[id]/gifts';
import { DbProvider } from '@/db/DbProvider';
import type { Db } from '@/db/db';
import { createPerson, getPersonDetail } from '@/db/people';
import { createTestDb } from '../../../testing/testDb';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn() }));
jest.mock('@/settings/store', () => ({
  loadSettings: jest.fn().mockResolvedValue({
    baseUrl: 'https://pc.example.ts.net',
    key: 'k',
    reminderLeadDays: 7,
    reminderHour: 9,
    reminderMinute: 0,
  }),
}));
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, createClient: jest.fn() };
});

const gifts = jest.fn();
const IDEAS = [
  { text: 'heirloom tomato seeds', why: 'She loves gardening.' },
  { text: 'kneeling pad', why: 'Easier weeding.' },
  { text: 'botanical garden pass', why: 'A day out among plants.' },
  { text: 'plant press', why: 'Keeps her favorite flowers.' },
  { text: 'garden journal', why: 'Tracks what she grows.' },
];

async function setup() {
  const db = await createTestDb();
  const id = await createPerson(
    db,
    {
      name: 'Margaret Lin',
      preferredName: 'Maggie',
      nicknames: [],
      relationship: 'aunt',
      birthday: null,
      address: null,
      phone: null,
      interests: ['gardening'],
      notes: [],
    },
    new Date('2026-09-01T12:00:00Z'),
  );
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: String(id) });
  await render(
    <DbProvider db={db}>
      <GiftIdeasScreen />
    </DbProvider>,
  );
  return { db, id };
}

describe('GiftIdeasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue({ gifts });
  });

  test('happy path - shows five ideas built from the person and occasion', async () => {
    // given
    gifts.mockResolvedValue({ ideas: IDEAS });
    await setup();

    // when
    await fireEvent.changeText(screen.getByTestId('occasion-input'), 'birthday');
    await fireEvent.press(screen.getByTestId('get-ideas'));

    // then
    expect(await screen.findByTestId('idea-4')).toHaveTextContent('garden journal');
    expect(screen.getByTestId('idea-why-0')).toHaveTextContent('She loves gardening.');
    expect(gifts).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Margaret Lin', interests: ['gardening'], occasion: 'birthday' }),
    );
  });

  test('happy path - saving an idea stores it once with source ai', async () => {
    // given
    gifts.mockResolvedValue({ ideas: IDEAS });
    const { db, id } = await setup();
    await fireEvent.press(screen.getByTestId('get-ideas'));
    await screen.findByTestId('save-idea-2');

    // when
    await fireEvent.press(screen.getByTestId('save-idea-2'));

    // then
    await waitFor(() => expect(screen.getByTestId('save-idea-2')).toBeDisabled());
    const detail = await getPersonDetail(db, id);
    expect(detail?.giftIdeas).toHaveLength(1);
    expect(detail?.giftIdeas[0]).toMatchObject({ text: 'botanical garden pass', source: 'ai' });
  });

  test('happy path - a new request clears saved marks', async () => {
    // given
    gifts.mockResolvedValue({ ideas: IDEAS });
    await setup();
    await fireEvent.press(screen.getByTestId('get-ideas'));
    await fireEvent.press(await screen.findByTestId('save-idea-0'));
    await waitFor(() => expect(screen.getByTestId('save-idea-0')).toBeDisabled());

    // when
    await fireEvent.press(screen.getByTestId('get-ideas'));

    // then
    await waitFor(() => expect(screen.getByTestId('save-idea-0')).toBeEnabled());
    expect(gifts).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['unreachable', "Can't reach the backend. Try again when it's on."],
    ['unauthorized', 'The backend key is wrong. Check Settings.'],
    ['upstream_failed', 'The backend had a problem. Try again.'],
  ] as const)('error - %s shows a message', async (code, message) => {
    // given
    gifts.mockRejectedValue(new ApiError(code, null, code));
    await setup();

    // when
    await fireEvent.press(screen.getByTestId('get-ideas'));

    // then
    expect(await screen.findByTestId('gifts-error')).toHaveTextContent(message);
    expect(screen.queryByTestId('idea-0')).toBeNull();
  });
});
