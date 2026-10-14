import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import PersonScreen from '@/app/person/[id]/index';
import { DbProvider } from '@/db/DbProvider';
import type { Db } from '@/db/db';
import { addNote } from '@/db/notes';
import { createPerson, getPersonDetail as getDetail } from '@/db/people';
import { syncDates } from '@/dates/sync';
import { createTestDb } from '../../../testing/testDb';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: jest.fn(),
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});
jest.mock('@/dates/sync', () => ({ syncDates: jest.fn().mockResolvedValue(undefined) }));

const NOW = new Date('2026-09-01T12:00:00Z');

async function seed(db: Db): Promise<number> {
  return createPerson(
    db,
    {
      name: 'Margaret Lin',
      preferredName: 'Maggie',
      nicknames: ['Mags'],
      relationship: 'aunt',
      birthday: null,
      address: null,
      phone: null,
      interests: ['gardening'],
      notes: [],
    },
    NOW,
  );
}

async function renderPerson(db: Db, id: number) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: String(id) });
  await render(
    <DbProvider db={db}>
      <PersonScreen />
    </DbProvider>,
  );
  await screen.findByTestId('person-title');
}

describe('PersonScreen', () => {
  let db: Db;
  let id: number;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await createTestDb();
    id = await seed(db);
  });

  test('error - unknown id shows not found', async () => {
    // given
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '999' });

    // when
    await render(
      <DbProvider db={db}>
        <PersonScreen />
      </DbProvider>,
    );

    // then
    expect(await screen.findByTestId('person-not-found')).toBeTruthy();
  });

  test('happy path - saving fields trims, nulls blanks, and syncs dates', async () => {
    // given
    await renderPerson(db, id);

    // when
    await fireEvent.changeText(screen.getByTestId('field-preferred-name'), '  ');
    await fireEvent.changeText(screen.getByTestId('field-phone'), ' 555-0100 ');
    await fireEvent.press(screen.getByTestId('save-fields'));

    // then
    await waitFor(() => expect(screen.getByTestId('person-title')).toHaveTextContent('Margaret Lin'));
    const detail = await getDetail(db, id);
    expect(detail?.preferredName).toBeNull();
    expect(detail?.phone).toBe('555-0100');
    expect(syncDates).toHaveBeenCalledTimes(1);
  });

  test('error - blank name is rejected', async () => {
    // given
    await renderPerson(db, id);

    // when
    await fireEvent.changeText(screen.getByTestId('field-name'), '   ');
    await fireEvent.press(screen.getByTestId('save-fields'));

    // then
    expect(await screen.findByTestId('fields-error')).toHaveTextContent('Name is required');
    expect((await getDetail(db, id))?.name).toBe('Margaret Lin');
    expect(syncDates).not.toHaveBeenCalled();
  });

  test('happy path - unsaved field edits survive adding an interest', async () => {
    // given
    await renderPerson(db, id);
    await fireEvent.changeText(screen.getByTestId('field-address'), '12 Elm St');

    // when
    await fireEvent.changeText(screen.getByTestId('add-interest-input'), 'birding');
    await fireEvent.press(screen.getByTestId('add-interest'));

    // then
    await screen.findByText('birding');
    expect(screen.getByTestId('field-address').props.value).toBe('12 Elm St');
  });

  test('happy path - add and remove a nickname', async () => {
    // given
    await renderPerson(db, id);
    await fireEvent.changeText(screen.getByTestId('add-nickname-input'), 'Peggy');
    await fireEvent.press(screen.getByTestId('add-nickname'));
    await screen.findByText('Peggy');
    const added = (await getDetail(db, id))!.nicknames.find((n) => n.text === 'Peggy')!;

    // when
    await fireEvent.press(screen.getByTestId(`remove-nickname-${added.id}`));

    // then
    await waitFor(() => expect(screen.queryByText('Peggy')).toBeNull());
  });

  test('happy path - mark a gift idea as given', async () => {
    // given
    await renderPerson(db, id);
    await fireEvent.changeText(screen.getByTestId('add-gift-idea-input'), 'seed catalog');
    await fireEvent.press(screen.getByTestId('add-gift-idea'));
    await screen.findByText('seed catalog');
    const idea = (await getDetail(db, id))!.giftIdeas[0];

    // when
    await fireEvent.press(screen.getByTestId(`mark-given-${idea.id}`));

    // then
    await waitFor(async () => {
      const detail = await getDetail(db, id);
      expect(detail?.giftIdeas).toHaveLength(0);
      expect(detail?.giftsGiven[0].text).toBe('seed catalog');
    });
  });

  test('happy path - add a birthday without a year', async () => {
    // given
    await renderPerson(db, id);

    // when
    await fireEvent.press(screen.getByTestId('add-birthday'));
    await fireEvent.changeText(screen.getByTestId('date-month'), '3');
    await fireEvent.changeText(screen.getByTestId('date-day'), '14');
    await fireEvent.press(screen.getByTestId('date-save'));

    // then
    expect(await screen.findByText('Birthday: 03/14')).toBeTruthy();
    expect(syncDates).toHaveBeenCalledTimes(1);
  });

  test('error - impossible date is not saved', async () => {
    // given
    await renderPerson(db, id);

    // when
    await fireEvent.press(screen.getByTestId('add-birthday'));
    await fireEvent.changeText(screen.getByTestId('date-month'), '2');
    await fireEvent.changeText(screen.getByTestId('date-day'), '30');
    await fireEvent.press(screen.getByTestId('date-save'));

    // then
    expect(await screen.findByTestId('date-error')).toBeTruthy();
    expect((await getDetail(db, id))?.dates).toHaveLength(0);
    expect(syncDates).not.toHaveBeenCalled();
  });

  test('happy path - add, edit, and delete a one-time date', async () => {
    // given
    await renderPerson(db, id);
    await fireEvent.press(screen.getByTestId('add-date'));
    await fireEvent.changeText(screen.getByTestId('date-label'), 'Surgery');
    await fireEvent.changeText(screen.getByTestId('date-month'), '11');
    await fireEvent.changeText(screen.getByTestId('date-day'), '2');
    await fireEvent.changeText(screen.getByTestId('date-year'), '2026');
    await fireEvent(screen.getByTestId('date-recurring'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('date-save'));
    await screen.findByText('Surgery: 11/02/2026 (once)');
    const date = (await getDetail(db, id))!.dates[0];

    // when
    await fireEvent.press(screen.getByTestId(`edit-date-${date.id}`));
    await fireEvent.changeText(screen.getByTestId('date-day'), '3');
    await fireEvent.press(screen.getByTestId('date-save'));
    await screen.findByText('Surgery: 11/03/2026 (once)');
    await fireEvent.press(screen.getByTestId(`delete-date-${date.id}`));

    // then
    await waitFor(() => expect(screen.queryByTestId(`date-${date.id}`)).toBeNull());
    expect(syncDates).toHaveBeenCalledTimes(3);
  });

  test('happy path - notes are listed newest first and typed notes are added', async () => {
    // given
    await addNote(db, id, 'older note', new Date('2026-08-01T12:00:00Z'), null);
    await addNote(db, id, 'newer note', new Date('2026-08-20T12:00:00Z'), null);
    await renderPerson(db, id);

    // when
    await fireEvent.changeText(screen.getByTestId('add-note-input'), 'typed note');
    await fireEvent.press(screen.getByTestId('add-note'));

    // then
    await screen.findByText(/typed note/);
    const texts = screen.getAllByTestId(/^note-/).map((n) => n.props.children as string);
    expect(texts[1]).toMatch(/newer note$/);
    expect(texts[2]).toMatch(/older note$/);
  });

  test('happy path - gift ideas button opens the gifts screen', async () => {
    // given
    await renderPerson(db, id);

    // when
    await fireEvent.press(screen.getByTestId('gift-ideas-button'));

    // then
    expect(router.push).toHaveBeenCalledWith(`/person/${id}/gifts`);
  });

  test('happy path - cancel then confirm delete', async () => {
    // given
    await renderPerson(db, id);
    await fireEvent.press(screen.getByTestId('delete-person'));
    await fireEvent.press(screen.getByTestId('cancel-delete'));
    expect(screen.queryByTestId('confirm-delete')).toBeNull();

    // when
    await fireEvent.press(screen.getByTestId('delete-person'));
    expect(screen.getByTestId('confirm-delete-text')).toHaveTextContent('Delete Maggie and everything about them?');
    await fireEvent.press(screen.getByTestId('confirm-delete'));

    // then
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(await getDetail(db, id)).toBeNull();
    expect(syncDates).toHaveBeenCalledTimes(1);
  });
});
