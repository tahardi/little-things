import { router, Stack } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { Button, Linking, StyleSheet, Text, View } from 'react-native';

import { createClient } from '@/api/client';
import { useRecorder } from '@/components/useRecorder';
import { createClip } from '@/db/clips';
import { useDb } from '@/db/DbProvider';
import { persistClip } from '@/processing/audioFiles';
import { processIfReachable } from '@/processing/processAll';
import { loadSettings } from '@/settings/store';

const STATUS = { idle: 'Ready', recording: 'Recording…', recorded: 'Recorded' } as const;

export default function NewNoteScreen() {
  const db = useDb();
  const recorder = useRecorder();
  const player = useAudioPlayer(recorder.uri);
  const recorded = recorder.state === 'recorded';

  async function save() {
    if (!recorder.uri) {
      return;
    }
    const now = new Date();
    await createClip(db, persistClip(recorder.uri, now), now);
    router.replace('/');
    const settings = await loadSettings();
    if (settings.baseUrl !== '' && settings.key !== '') {
      processIfReachable({ db, client: createClient(settings) }).catch(() => undefined);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Add Note' }} />
      {recorder.permissionDenied && (
        <View>
          <Text testID="mic-denied">Microphone access is off</Text>
          <Button testID="open-mic-settings" title="Open Settings" onPress={() => Linking.openSettings()} />
        </View>
      )}
      <Text testID="record-status">{STATUS[recorder.state]}</Text>
      <Button
        testID="record-button"
        title={recorder.state === 'recording' ? 'Stop' : 'Record'}
        onPress={() => (recorder.state === 'recording' ? recorder.stop() : recorder.start())}
      />
      <Button testID="play-button" title="Play" disabled={!recorded} onPress={() => player.play()} />
      <Button testID="rerecord-button" title="Re-record" disabled={!recorded} onPress={recorder.reset} />
      <Button testID="save-button" title="Save" disabled={!recorded} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
});
