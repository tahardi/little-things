import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { upcoming } from '@/dates/upcoming';
import { listAllDates } from '@/db/dates';
import { useDb } from '@/db/DbProvider';
import { listPeople } from '@/db/people';
import type { DateWithPerson, Person } from '@/db/types';
import { displayName } from '@/people/displayName';

function when(daysAway: number): string {
  if (daysAway === 0) {
    return 'today';
  }
  return daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`;
}

export default function PeopleScreen() {
  const db = useDb();
  const [people, setPeople] = useState<Person[]>([]);
  const [dates, setDates] = useState<DateWithPerson[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [p, d] = await Promise.all([listPeople(db), listAllDates(db)]);
        if (!cancelled) {
          setPeople(p);
          setDates(d);
        }
      })().catch((e: unknown) => console.warn('loading people failed', e));
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const soon = useMemo(() => upcoming(dates, new Date()), [dates]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') {
      return people;
    }
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.preferredName?.toLowerCase().includes(q));
  }, [people, query]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button testID="add-note" title="Add Note" onPress={() => router.push('/note/new')} />
      {soon.length > 0 && (
        <View testID="upcoming-strip" style={styles.strip}>
          {soon.map((item) => (
            <Text key={item.date.id} testID={`upcoming-${item.date.id}`}>
              {`${item.date.displayName} · ${item.date.label} · ${when(item.daysAway)}`}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.searchRow}>
        <TextInput
          testID="people-search"
          placeholder="Search"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <Button testID="add-person" title="+" onPress={() => router.push('/person/new')} />
      </View>
      {people.length === 0 ? (
        <Text testID="people-empty">No people yet. Tap + to add someone.</Text>
      ) : (
        shown.map((p) => (
          <Pressable
            key={p.id}
            testID={`person-row-${p.id}`}
            onPress={() => router.push('/person/' + p.id)}
            style={styles.row}
          >
            <Text style={styles.name}>{displayName(p)}</Text>
            {p.relationship ? <Text>{p.relationship}</Text> : null}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  strip: { gap: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 },
  row: { paddingVertical: 8 },
  name: { fontSize: 17 },
});
