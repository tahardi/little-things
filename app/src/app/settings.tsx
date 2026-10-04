import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { ApiError, createClient } from '@/api/client';
import { syncDates } from '@/dates/sync';
import { useDb } from '@/db/DbProvider';
import { loadSettings, saveSettings } from '@/settings/store';

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function connectionStatus(e: unknown): string {
  if (e instanceof ApiError && e.code === 'unauthorized') {
    return 'Wrong key';
  }
  if (e instanceof ApiError && e.code === 'unreachable') {
    return "Can't reach backend";
  }
  return 'Backend error';
}

export default function SettingsScreen() {
  const db = useDb();
  const [baseUrl, setBaseUrl] = useState('');
  const [key, setKey] = useState('');
  const [leadDays, setLeadDays] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((s) => {
        if (cancelled) {
          return;
        }
        setBaseUrl(s.baseUrl);
        setKey(s.key);
        setLeadDays(String(s.reminderLeadDays));
        setTime(formatTime(s.reminderHour, s.reminderMinute));
      })
      .catch((e: unknown) => setStatus(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    const match = TIME_PATTERN.exec(time.trim());
    if (!match) {
      setStatus('reminder time is not valid');
      return;
    }
    try {
      await saveSettings({
        baseUrl,
        key,
        reminderLeadDays: Number(leadDays),
        reminderHour: Number(match[1]),
        reminderMinute: Number(match[2]),
      });
      await syncDates(db);
      setStatus('Saved');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  async function testConnection() {
    try {
      await createClient({ baseUrl, key }).health();
      setStatus('Connected');
    } catch (e) {
      setStatus(connectionStatus(e));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text>Backend URL</Text>
      <TextInput
        testID="settings-url"
        value={baseUrl}
        onChangeText={setBaseUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />
      <Text>Key</Text>
      <TextInput
        testID="settings-key"
        value={key}
        onChangeText={setKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Text>Reminder lead days</Text>
      <TextInput
        testID="settings-lead-days"
        value={leadDays}
        onChangeText={setLeadDays}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Text>Reminder time (HH:MM)</Text>
      <TextInput testID="settings-reminder-time" value={time} onChangeText={setTime} style={styles.input} />
      <Button testID="settings-save" title="Save" onPress={save} />
      <Button testID="settings-test" title="Test connection" onPress={testConnection} />
      <Text testID="settings-status">{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 },
});
