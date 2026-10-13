import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, createClient } from '@/api/client';
import AddPersonScreen from '@/app/person/new';
import { useRecorder } from '@/components/useRecorder';
import { syncDates } from '@/dates/sync';
import { DbProvider } from '@/db/DbProvider';
import type { Db } from '@/db/db';
import { getPersonDetail, listPeople } from '@/db/people';
import { createTestDb } from '../../../testing/testDb';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('@/components/useRecorder', () => ({ useRecorder: jest.fn() }));
jest.mock('@/dates/sync', () => ({ syncDates: jest.fn().mockResolvedValue(undefined) }));
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

type RecorderState = ReturnType<typeof useRecorder>;

let recorder: RecorderState;
const field = jest.fn();

function setRecorder(patch: Partial<RecorderState>) {
  recorder = { ...recorder, ...patch };
  (useRecorder as jest.Mock).mockReturnValue(recorder);
}

async function renderScreen(db: Db) {
  const utils = await render(
    <DbProvider db={db}>
      <AddPersonScreen />
    </DbProvider>,
  );
  const rerender = async () =>
    utils.rerender(
      <DbProvider db={db}>
        <AddPersonScreen />
      </DbProvider>,
    );
  return { rerender };
}

async function recordClip(rerender: () => Promise<void>) {
  await fireEvent.press(screen.getByTestId('record-button'));
  setRecorder({ state: 'recording' });
  await rerender();
  await fireEvent.press(screen.getByTestId('record-button'));
  setRecorder({ state: 'recorded', uri: 'file:///clip.m4a' });
  await act(async () => {
    await rerender();
  });
}

describe('AddPersonScreen', () => {
  let db: Db;

  beforeEach(async () => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    db = await createTestDb();
    setRecorder({
      state: 'idle',
      uri: null,
      permissionDenied: false,
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(() => setRecorder({ state: 'idle', uri: null })),
    });
    (createClient as jest.Mock).mockReturnValue({ field });
  });

  test('happy path - next is disabled until a name is typed', async () => {
    // given
    await renderScreen(db);
    expect(screen.getByTestId('next-button')).toBeDisabled();

    // when
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Priya Nair');

    // then
    expect(screen.getByTestId('next-button')).toBeEnabled();
    expect(screen.queryByTestId('skip-button')).toBeNull();
  });

  test('happy path - a recorded clip fills the answer', async () => {
    // given
    field.mockResolvedValue({ transcript: 'priya nair', value: 'Priya Nair' });
    const { rerender } = await renderScreen(db);

    // when
    await recordClip(rerender);

    // then
    await waitFor(() => expect(screen.getByTestId('answer-input').props.value).toBe('Priya Nair'));
    expect(field).toHaveBeenCalledWith('file:///clip.m4a', 'name');
    expect(recorder.start).toHaveBeenCalled();
    expect(recorder.stop).toHaveBeenCalled();
    expect(recorder.reset).toHaveBeenCalled();
  });

  test('happy path - birthday value fills three inputs', async () => {
    // given
    field.mockResolvedValue({ transcript: 'march fourteenth', value: { month: 3, day: 14, year: null } });
    const { rerender } = await renderScreen(db);
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Priya Nair');
    for (let i = 0; i < 4; i += 1) {
      await fireEvent.press(screen.getByTestId('next-button'));
    }
    expect(screen.getByTestId('step-counter')).toHaveTextContent('5 of 8');

    // when
    await recordClip(rerender);

    // then
    await waitFor(() => expect(screen.getByTestId('birthday-month').props.value).toBe('3'));
    expect(screen.getByTestId('birthday-day').props.value).toBe('14');
    expect(screen.getByTestId('birthday-year').props.value).toBe('');
    expect(field).toHaveBeenCalledWith('file:///clip.m4a', 'birthday');
  });

  test.each([
    ['no_speech', "Didn't catch that"],
    ['unreachable', "Can't reach the backend. Type the answer instead."],
    ['unreadable_date', "Couldn't read a date. Record again or type it."],
    ['upstream_failed', 'The backend had a problem. Record again or type the answer.'],
  ] as const)('error - %s shows inline and typing still works', async (code, message) => {
    // given
    field.mockRejectedValue(new ApiError(code, null, code));
    const { rerender } = await renderScreen(db);

    // when
    await recordClip(rerender);

    // then
    expect(await screen.findByTestId('field-error')).toHaveTextContent(message);
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Priya Nair');
    expect(screen.getByTestId('next-button')).toBeEnabled();
  });

  test('happy path - microphone denied shows settings link and keeps typing', async () => {
    // given
    setRecorder({ permissionDenied: true });

    // when
    await renderScreen(db);

    // then
    expect(screen.getByTestId('mic-denied')).toBeTruthy();
    expect(screen.getByTestId('open-mic-settings')).toBeTruthy();
    expect(screen.queryByTestId('record-button')).toBeNull();
    expect(screen.getByTestId('answer-input')).toBeTruthy();
  });

  test('happy path - name search param prefills the name step', async () => {
    // given
    (useLocalSearchParams as jest.Mock).mockReturnValue({ name: ' Priya Nair ' });

    // when
    await renderScreen(db);

    // then
    expect(screen.getByTestId('answer-input').props.value).toBe('Priya Nair');
    expect(screen.getByTestId('next-button')).toBeEnabled();
  });

  test('happy path - back keeps answers and skip clears the current one', async () => {
    // given
    await renderScreen(db);
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Priya Nair');
    await fireEvent.press(screen.getByTestId('next-button'));
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Pri');

    // when
    await fireEvent.press(screen.getByTestId('skip-button'));
    await fireEvent.press(screen.getByTestId('back-button'));

    // then
    expect(screen.getByTestId('step-counter')).toHaveTextContent('2 of 8');
    expect(screen.getByTestId('answer-input').props.value).toBe('');
    await fireEvent.press(screen.getByTestId('back-button'));
    expect(screen.getByTestId('answer-input').props.value).toBe('Priya Nair');
  });

  test('happy path - save creates the person with notes and opens them', async () => {
    // given
    await renderScreen(db);
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Samuel Ortiz');
    await fireEvent.press(screen.getByTestId('next-button'));
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Sam');
    for (let i = 0; i < 6; i += 1) {
      await fireEvent.press(screen.getByTestId('next-button'));
    }
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'chess, gardening');

    // when
    await fireEvent.press(screen.getByTestId('save-button'));

    // then
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const [person] = await listPeople(db);
    expect(router.replace).toHaveBeenCalledWith(`/person/${person.id}`);
    const detail = await getPersonDetail(db, person.id);
    expect(detail?.preferredName).toBe('Sam');
    expect(detail?.interests.map((i) => i.text)).toEqual(['chess', 'gardening']);
    expect(detail?.notes.map((n) => n.text).sort()).toEqual(
      ['Interests: chess, gardening', 'Name: Samuel Ortiz', 'Preferred name: Sam'].sort(),
    );
    expect(syncDates).toHaveBeenCalledTimes(1);
  });

  test('error - impossible birthday blocks save', async () => {
    // given
    await renderScreen(db);
    await fireEvent.changeText(screen.getByTestId('answer-input'), 'Priya Nair');
    for (let i = 0; i < 4; i += 1) {
      await fireEvent.press(screen.getByTestId('next-button'));
    }
    await fireEvent.changeText(screen.getByTestId('birthday-month'), '2');
    await fireEvent.changeText(screen.getByTestId('birthday-day'), '30');
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByTestId('next-button'));
    }

    // when
    await fireEvent.press(screen.getByTestId('save-button'));

    // then
    expect(await screen.findByTestId('form-error')).toHaveTextContent('Birthday is not a real date');
    expect(await listPeople(db)).toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
