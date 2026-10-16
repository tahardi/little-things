import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Button, ScrollView, Text, TextInput, View } from 'react-native';

import { ApiError, createClient } from '@/api/client';
import type { GiftIdea } from '@/api/types';
import { useDb } from '@/db/DbProvider';
import { addGiftIdea } from '@/db/gifts';
import { getPersonDetail } from '@/db/people';
import { giftsErrorMessage, toGiftsRequest } from '@/gifts/request';
import { loadSettings } from '@/settings/store';

export default function GiftIdeasScreen() {
  const db = useDb();
  const personId = Number(useLocalSearchParams<{ id: string }>().id);
  const [occasion, setOccasion] = useState('');
  const [ideas, setIdeas] = useState<GiftIdea[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getIdeas() {
    setLoading(true);
    setError(null);
    try {
      const person = await getPersonDetail(db, personId);
      if (!person) {
        setError('Person not found');
        return;
      }
      const client = createClient(await loadSettings());
      const response = await client.gifts(toGiftsRequest(person, occasion));
      setIdeas(response.ideas);
      setSaved(new Set());
    } catch (e) {
      setIdeas([]);
      setError(giftsErrorMessage(e instanceof ApiError ? e.code : 'upstream_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function saveIdea(index: number) {
    setSaved((current) => new Set(current).add(index));
    await addGiftIdea(db, personId, ideas[index].text, 'ai', new Date());
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TextInput
        testID="occasion-input"
        value={occasion}
        onChangeText={setOccasion}
        placeholder="Occasion (optional)"
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 }}
      />
      <Button testID="get-ideas" title="Get ideas" disabled={loading} onPress={getIdeas} />
      {loading && <ActivityIndicator testID="gifts-loading" />}
      {error && <Text testID="gifts-error">{error}</Text>}
      {ideas.map((idea, index) => (
        <View key={`${index}-${idea.text}`} style={{ gap: 4 }}>
          <Text testID={`idea-${index}`} style={{ fontSize: 16, fontWeight: '600' }}>
            {idea.text}
          </Text>
          <Text testID={`idea-why-${index}`}>{idea.why}</Text>
          <Button
            testID={`save-idea-${index}`}
            title={saved.has(index) ? 'Saved' : 'Save'}
            disabled={saved.has(index)}
            onPress={() => saveIdea(index)}
          />
        </View>
      ))}
    </ScrollView>
  );
}
