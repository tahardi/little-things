import { router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { DbProvider } from '@/db/DbProvider';

function SettingsButton() {
  return (
    <Pressable testID="open-settings" accessibilityLabel="Settings" onPress={() => router.push('/settings')}>
      <Text>⚙</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <DbProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'People', headerRight: () => <SettingsButton /> }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </DbProvider>
  );
}
