import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type { Unknown } from '@/api/types';
import { syncDates } from '@/dates/sync';
import { getClip } from '@/db/clips';
import { useDb } from '@/db/DbProvider';
import { listPeople } from '@/db/people';
import { applyReview } from '@/db/review';
import type { Clip, Person } from '@/db/types';
import { displayName } from '@/people/displayName';
import { deleteClipFile } from '@/processing/audioFiles';
import { buildApproved, describeChange, hasEditableText, type MatchDraft, toDrafts } from '@/review/buildApproved';

type Loaded = { clip: Clip; people: Map<number, Person>; transcript: string; notes: string; unknown: Unknown[] };

export default function ReviewScreen() {
  const db = useDb();
  const { clipId } = useLocalSearchParams<{ clipId: string }>();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [drafts, setDrafts] = useState<MatchDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const clip = await getClip(db, Number(clipId));
      if (!clip || clip.status !== 'review' || clip.result === null) {
        setLoaded(null);
        return;
      }
      const people = await listPeople(db);
      setDrafts(toDrafts(clip.result));
      setLoaded({
        clip,
        people: new Map(people.map((p) => [p.id, p])),
        transcript: clip.result.transcript,
        notes: clip.result.notes,
        unknown: clip.result.unknown,
      });
    })();
  }, [db, clipId]);

  function updateDraft(index: number, update: (d: MatchDraft) => MatchDraft) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? update(d) : d)));
  }

  function setApproved(index: number, changeIndex: number, approved: boolean) {
    updateDraft(index, (d) => ({
      ...d,
      changes: d.changes.map((c, i) => (i === changeIndex ? { ...c, approved } : c)),
    }));
  }

  function setChangeText(index: number, changeIndex: number, text: string) {
    updateDraft(index, (d) => ({
      ...d,
      changes: d.changes.map((c, i) => (i === changeIndex ? { ...c, change: { ...c.change, text } } : c)),
    }));
  }

  async function save(clip: Clip) {
    setSaving(true);
    try {
      await applyReview(db, clip.id, buildApproved(drafts), new Date());
      try {
        deleteClipFile(clip.fileUri);
      } catch (e) {
        console.warn('deleting clip file failed', e);
      }
      await syncDates(db);
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  if (loaded === undefined) {
    return <Stack.Screen options={{ title: 'Review' }} />;
  }

  if (loaded === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Review' }} />
        <Text testID="review-empty">Nothing to review</Text>
        <Button testID="home-button" title="Home" onPress={() => router.replace('/')} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Review' }} />
      <Text testID="review-transcript">{loaded.transcript}</Text>
      {loaded.notes !== '' && <Text testID="review-notes">{loaded.notes}</Text>}
      {drafts.map((draft, index) => {
        const person = loaded.people.get(draft.personId);
        if (!person) {
          return (
            <View key={draft.personId} testID={`match-${draft.personId}`} style={styles.card}>
              <Text style={styles.title}>Person no longer exists</Text>
            </View>
          );
        }
        return (
          <View key={draft.personId} testID={`match-${draft.personId}`} style={styles.card}>
            <Text style={styles.title}>{displayName(person)}</Text>
            <TextInput
              testID={`note-input-${draft.personId}`}
              value={draft.note}
              onChangeText={(note) => updateDraft(index, (d) => ({ ...d, note }))}
              multiline
              style={styles.input}
            />
            {draft.changes.map((c, i) => (
              <View key={i} style={styles.change}>
                <View style={styles.row}>
                  <Text testID={`change-${draft.personId}-${i}`} style={styles.label}>
                    {describeChange(c.change)}
                  </Text>
                  <Switch
                    testID={`change-toggle-${draft.personId}-${i}`}
                    value={c.approved}
                    onValueChange={(approved) => setApproved(index, i, approved)}
                  />
                </View>
                {hasEditableText(c.change) && (
                  <TextInput
                    testID={`change-edit-${draft.personId}-${i}`}
                    value={c.change.text ?? ''}
                    onChangeText={(text) => setChangeText(index, i, text)}
                    style={styles.input}
                  />
                )}
              </View>
            ))}
          </View>
        );
      })}
      {loaded.unknown.map((u, i) => (
        <View key={i} testID={`unknown-${i}`} style={styles.card}>
          <Text selectable style={styles.title}>
            {u.name}
          </Text>
          <Text selectable>{u.text}</Text>
          <Button
            testID={`add-person-${i}`}
            title="Add Person"
            onPress={() => router.push({ pathname: '/person/new', params: { name: u.name } })}
          />
        </View>
      ))}
      <Button testID="review-save" title="Save" disabled={saving} onPress={() => save(loaded.clip)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  title: { fontWeight: '600' },
  change: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexShrink: 1 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
});
