import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Button, Linking, Text, View } from 'react-native';

export function NotificationStatus() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((permission) => setGranted(permission.granted));
  }, []);

  if (granted === null) {
    return null;
  }
  return (
    <View>
      <Text testID="notification-status">
        {granted ? 'Reminders: on' : 'Reminders: off. Allow notifications for Expo Go in iOS Settings.'}
      </Text>
      {!granted && (
        <Button testID="notification-open-settings" title="Open Settings" onPress={() => Linking.openSettings()} />
      )}
    </View>
  );
}
