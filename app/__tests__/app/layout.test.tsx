import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import PeopleScreen from '@/app/index';
import SettingsScreen from '@/app/settings';
import { createTestDb } from '../../testing/testDb';

jest.mock('@/db/db', () => ({ openDb: jest.fn() }));
jest.mock('@/settings/store', () => ({
  loadSettings: jest.fn().mockResolvedValue({
    baseUrl: '',
    key: '',
    reminderLeadDays: 7,
    reminderHour: 9,
    reminderMinute: 0,
  }),
  saveSettings: jest.fn(),
}));

describe('RootLayout', () => {
  test('shows People and opens Settings from the header', async () => {
    const { openDb } = jest.requireMock('@/db/db');
    openDb.mockResolvedValue(await createTestDb());

    const view = renderRouter({ _layout: RootLayout, index: PeopleScreen, settings: SettingsScreen });
    await view;

    expect(await screen.findByTestId('people-empty')).toBeOnTheScreen();
    expect(JSON.stringify(await screen.toJSON())).toContain('"title":"People"');

    await fireEvent.press(screen.getByTestId('open-settings'));

    expect(await screen.findByTestId('settings-save')).toBeOnTheScreen();
    expect(view.getPathname()).toBe('/settings');
  });
});
