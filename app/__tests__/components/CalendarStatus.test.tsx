import { render, screen } from '@testing-library/react-native';

import type { CalendarSyncState, CalendarSyncStore } from '@/calendar/sync';
import { CalendarStatus, calendarStatusText } from '@/components/CalendarStatus';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const synced = '2026-09-29T14:00:00.000Z';

describe('calendarStatusText', () => {
  test.each<[string, CalendarSyncState, string]>([
    [
      'synced',
      { pending: false, status: 'ok', lastSyncedAt: synced },
      `Calendar synced ${new Date(synced).toLocaleString()}`,
    ],
    ['never synced', { pending: false, status: 'ok', lastSyncedAt: null }, 'Calendar not synced yet'],
    ['pending', { pending: true, status: 'pending', lastSyncedAt: synced }, 'Calendar sync pending'],
    [
      'not configured',
      { pending: true, status: 'not_configured', lastSyncedAt: null },
      'Calendar not set up on backend',
    ],
  ])('%s', (_name, state, want) => {
    expect(calendarStatusText(state)).toBe(want);
  });
});

describe('CalendarStatus', () => {
  it('shows the stored status', async () => {
    const store: CalendarSyncStore = {
      load: async () => ({ pending: true, status: 'pending', lastSyncedAt: null }),
      save: async () => {},
    };

    await render(<CalendarStatus store={store} />);

    expect(await screen.findByText('Calendar sync pending')).toBeTruthy();
  });
});
