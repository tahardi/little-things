import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { createClient } from '@/api/client';
import { listOpenClips } from '@/db/clips';
import { useDb } from '@/db/DbProvider';
import type { Clip } from '@/db/types';
import { currentRun, processAll } from '@/processing/processAll';
import { loadSettings } from '@/settings/store';

function statusText(clip: Clip): string {
  switch (clip.status) {
    case 'review':
      return 'Ready to review';
    case 'processing':
      return currentRun() ? 'Processing…' : 'Waiting to process';
    default:
      return 'Waiting to process';
  }
}

export function QueueBanner() {
  const db = useDb();
  const [clips, setClips] = useState<Clip[]>([]);
  const [configured, setConfigured] = useState(true);
  const [healthy, setHealthy] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [open, settings] = await Promise.all([listOpenClips(db), loadSettings()]);
    const complete = settings.baseUrl !== '' && settings.key !== '';
    const ok =
      complete &&
      (await createClient(settings)
        .health()
        .then(
          () => true,
          () => false,
        ));
    setClips(open);
    setConfigured(complete);
    setHealthy(ok);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await load();
        const run = currentRun();
        if (run && !cancelled) {
          await run.catch(() => undefined);
          if (!cancelled) {
            await load();
          }
        }
      })().catch((e: unknown) => console.warn('loading queue failed', e));
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function onProcessAll() {
    const settings = await loadSettings();
    setRunning(true);
    try {
      await processAll({ db, client: createClient(settings) });
    } finally {
      setRunning(false);
      await load();
    }
  }

  if (clips.length === 0) {
    return null;
  }

  const pending = clips.filter((c) => c.status === 'queued' || c.status === 'processing').length;
  const busy = running || currentRun() !== null;

  return (
    <View style={styles.container}>
      {clips.map((clip) => (
        <View key={clip.id} testID={`clip-${clip.id}`} style={styles.row}>
          <Text>{new Date(clip.createdAt).toLocaleString()}</Text>
          <Text>{statusText(clip)}</Text>
          {clip.status === 'queued' && clip.error ? <Text testID={`clip-error-${clip.id}`}>{clip.error}</Text> : null}
          {clip.status === 'review' && (
            <Button testID={`review-${clip.id}`} title="Review" onPress={() => router.push(`/review/${clip.id}`)} />
          )}
        </View>
      ))}
      {!configured && <Text testID="queue-setup-hint">Set up the backend in Settings</Text>}
      <Button
        testID="process-all"
        title={busy ? 'Processing…' : `Process ${pending} notes`}
        disabled={pending === 0 || !healthy || busy}
        onPress={onProcessAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { gap: 4 },
});
