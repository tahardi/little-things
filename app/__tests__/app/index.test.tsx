process.env.TZ = 'America/New_York';

import { fireEvent, render, screen } from '@testing-library/react-native';

import PeopleScreen from '@/app/index';
import { setBirthday } from '@/db/dates';
import { type Db } from '@/db/db';
import { DbProvider } from '@/db/DbProvider';
import { createClip } from '@/db/clips';
import { createPerson } from '@/db/people';
import { createTestDb } from '../../testing/testDb';

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock('@/settings/store', () => ({
  loadSettings: jest.fn().mockResolvedValue({
    baseUrl: 'http://backend',
    key: 'secret',
    reminderLeadDays: 7,
    reminderHour: 9,
    reminderMinute: 0,
  }),
}));

jest.mock('@/api/client', () => ({
  createClient: () => ({ health: jest.fn().mockResolvedValue({ status: 'ok' }) }),
}));

function addPerson(db: Db, name: string, extra: { preferredName?: string; relationship?: string } = {}) {
  return createPerson(
    db,
    {
      name,
      preferredName: extra.preferredName ?? null,
      nicknames: [],
      relationship: extra.relationship ?? null,
      birthday: null,
      address: null,
      phone: null,
      interests: [],
      notes: [],
    },
    new Date(),
  );
}

async function renderScreen(db: Db) {
  await render(
    <DbProvider db={db}>
      <PeopleScreen />
    </DbProvider>,
  );
}

describe('PeopleScreen', () => {
  let db: Db;

  beforeEach(async () => {
    jest.useFakeTimers({
      now: new Date(2026, 9, 1, 12),
      doNotFake: ['setTimeout', 'setImmediate', 'queueMicrotask', 'nextTick'],
    });
    mockPush.mockClear();
    db = await createTestDb();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows the empty state with no people', async () => {
    await renderScreen(db);

    expect(await screen.findByTestId('people-empty')).toHaveTextContent('No people yet. Tap + to add someone.');
    expect(screen.queryByTestId('upcoming-strip')).toBeNull();
  });

  test('lists people by display name with relationship', async () => {
    const maggie = await addPerson(db, 'Margaret Lin', { preferredName: 'Maggie', relationship: 'Aunt' });
    await renderScreen(db);

    const row = await screen.findByTestId(`person-row-${maggie}`);

    expect(row).toHaveTextContent(/Maggie/);
    expect(row).toHaveTextContent(/Aunt/);
    expect(screen.queryByText('Margaret Lin')).toBeNull();
  });

  test.each([
    ['name', 'sam', ['Sam Ortiz']],
    ['preferred name, case-insensitive', 'MAGGIE', ['Maggie']],
    ['real name when a preferred name is set', 'lin', ['Maggie']],
  ])('search matches %s', async (_name, query, want) => {
    await addPerson(db, 'Sam Ortiz');
    await addPerson(db, 'Margaret Lin', { preferredName: 'Maggie' });
    await renderScreen(db);
    await screen.findByText('Sam Ortiz');

    await fireEvent.changeText(screen.getByTestId('people-search'), query);

    for (const name of ['Sam Ortiz', 'Maggie']) {
      if (want.includes(name)) {
        expect(screen.getByText(name)).toBeOnTheScreen();
      } else {
        expect(screen.queryByText(name)).toBeNull();
      }
    }
  });

  test.each([
    [10, 1, 'Priya Nair · Birthday · today'],
    [10, 2, 'Priya Nair · Birthday · tomorrow'],
    [10, 11, 'Priya Nair · Birthday · in 10 days'],
  ])('shows upcoming birthday on %i/%i', async (month, day, want) => {
    const id = await addPerson(db, 'Priya Nair');
    await setBirthday(db, id, { month, day, year: null });
    await renderScreen(db);

    const item = await screen.findByTestId(/^upcoming-\d+$/);

    expect(item).toHaveTextContent(want);
    expect(screen.getByTestId('upcoming-strip')).toBeOnTheScreen();
  });

  test('hides dates outside the window', async () => {
    const id = await addPerson(db, 'Priya Nair');
    await setBirthday(db, id, { month: 12, day: 25, year: null });
    await renderScreen(db);
    await screen.findByText('Priya Nair');

    expect(screen.queryByTestId('upcoming-strip')).toBeNull();
  });

  test('navigates from the buttons and rows', async () => {
    const id = await addPerson(db, 'Sam Ortiz');
    await renderScreen(db);
    await screen.findByText('Sam Ortiz');

    await fireEvent.press(screen.getByTestId('add-note'));
    await fireEvent.press(screen.getByTestId('add-person'));
    await fireEvent.press(screen.getByTestId(`person-row-${id}`));

    expect(mockPush.mock.calls).toEqual([['/note/new'], ['/person/new'], [`/person/${id}`]]);
  });

  test('shows the queue banner when a clip is queued', async () => {
    await createClip(db, 'file:///a.m4a', new Date());
    await renderScreen(db);

    expect(await screen.findByTestId('process-all')).toBeOnTheScreen();
  });
});
