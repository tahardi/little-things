import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import { NotificationStatus } from '@/components/NotificationStatus';

jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn() }));

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;

describe('NotificationStatus', () => {
  it('shows reminders on when granted', async () => {
    getPermissions.mockResolvedValue({ granted: true });

    await render(<NotificationStatus />);

    expect(await screen.findByText('Reminders: on')).toBeTruthy();
    expect(screen.queryByTestId('notification-open-settings')).toBeNull();
  });

  it('explains how to turn reminders on when denied', async () => {
    getPermissions.mockResolvedValue({ granted: false });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await render(<NotificationStatus />);
    await fireEvent.press(await screen.findByTestId('notification-open-settings'));

    expect(screen.getByTestId('notification-status').props.children).toBe(
      'Reminders: off. Allow notifications for Expo Go in iOS Settings.',
    );
    expect(openSettings).toHaveBeenCalled();
  });
});
