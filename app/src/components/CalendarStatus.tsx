import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { type CalendarSyncState, type CalendarSyncStore, secureCalendarStore } from '@/calendar/sync';

export function calendarStatusText(state: CalendarSyncState): string {
  if (state.status === 'not_configured') {
    return 'Calendar not set up on backend';
  }
  if (state.status === 'pending') {
    return 'Calendar sync pending';
  }
  return state.lastSyncedAt
    ? `Calendar synced ${new Date(state.lastSyncedAt).toLocaleString()}`
    : 'Calendar not synced yet';
}

export function CalendarStatus({ store = secureCalendarStore }: { store?: CalendarSyncStore }) {
  const [state, setState] = useState<CalendarSyncState | null>(null);

  useFocusEffect(
    useCallback(() => {
      store.load().then(setState);
    }, [store]),
  );

  if (state === null) {
    return null;
  }
  return <Text testID="calendar-status">{calendarStatusText(state)}</Text>;
}
