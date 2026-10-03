import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { syncDates } from '@/dates/sync';
import { createClip, getClip, claimNextQueued } from '@/db/clips';
import { type Db, openDb } from '@/db/db';
import { DbProvider, useDb } from '@/db/DbProvider';
import { createTestDb } from '../../testing/testDb';

jest.mock('@/db/db', () => ({ openDb: jest.fn() }));
jest.mock('@/dates/sync', () => ({ syncDates: jest.fn().mockResolvedValue(undefined) }));

const mockOpenDb = openDb as jest.MockedFunction<typeof openDb>;
const mockSyncDates = syncDates as jest.MockedFunction<typeof syncDates>;

describe('DbProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncDates.mockResolvedValue(undefined);
  });

  test('opens the database, requeues processing clips, and syncs dates', async () => {
    const db = await createTestDb();
    const id = await createClip(db, 'file:///a.m4a', new Date());
    await claimNextQueued(db);
    mockOpenDb.mockResolvedValue(db);

    await render(
      <DbProvider>
        <Text>ready</Text>
      </DbProvider>,
    );

    expect(await screen.findByText('ready')).toBeOnTheScreen();
    expect((await getClip(db, id))?.status).toBe('queued');
    expect(mockSyncDates).toHaveBeenCalledTimes(1);
    expect(mockSyncDates).toHaveBeenCalledWith(db);
  });

  test('still renders children when syncing dates fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockOpenDb.mockResolvedValue(await createTestDb());
    mockSyncDates.mockRejectedValue(new Error('calendar down'));

    await render(
      <DbProvider>
        <Text>ready</Text>
      </DbProvider>,
    );

    expect(await screen.findByText('ready')).toBeOnTheScreen();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('shows an error when opening fails', async () => {
    mockOpenDb.mockRejectedValue(new Error('disk full'));

    await render(
      <DbProvider>
        <Text>ready</Text>
      </DbProvider>,
    );

    expect(await screen.findByTestId('db-error')).toHaveTextContent('Could not open the database: disk full');
  });

  test('renders children immediately with a db prop and never opens', async () => {
    const db: Db = await createTestDb();

    await render(
      <DbProvider db={db}>
        <Text>ready</Text>
      </DbProvider>,
    );

    expect(screen.getByText('ready')).toBeOnTheScreen();
    expect(mockOpenDb).not.toHaveBeenCalled();
    expect(mockSyncDates).not.toHaveBeenCalled();
  });
});

describe('useDb', () => {
  test('throws outside a provider', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useDb();
      return null;
    }

    await expect(render(<Probe />)).rejects.toThrow('useDb must be used inside DbProvider');
    error.mockRestore();
  });
});
