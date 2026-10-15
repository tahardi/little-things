import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Linking, ScrollView, Text, TextInput, View } from 'react-native';

import { ApiError, createClient } from '@/api/client';
import type { Field } from '@/api/types';
import { useRecorder } from '@/components/useRecorder';
import { syncDates } from '@/dates/sync';
import { useDb } from '@/db/DbProvider';
import { createPerson } from '@/db/people';
import {
  EMPTY_ANSWERS,
  EMPTY_BIRTHDAY,
  STEPS,
  fieldErrorMessage,
  fromFieldValue,
  toNewPerson,
  validateAnswers,
  type Answers,
  type BirthdayDraft,
} from '@/people/addPersonSteps';
import { loadSettings } from '@/settings/store';

const inputStyle = { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 };

export default function AddPersonScreen() {
  const db = useDb();
  const recorder = useRecorder();
  const { name: initialName } = useLocalSearchParams<{ name?: string }>();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ ...EMPTY_ANSWERS, name: initialName?.trim() ?? '' });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const locked = busy || saving || recorder.state === 'recording';

  function setAnswer(field: Field, value: string | BirthdayDraft) {
    setAnswers((current) => ({ ...current, [field]: value }) as Answers);
  }

  useEffect(() => {
    if (recorder.state !== 'recorded' || !recorder.uri) {
      return;
    }
    const uri = recorder.uri;
    const current = step;
    recorder.reset();
    void (async () => {
      setBusy(true);
      setFieldError(null);
      try {
        const client = createClient(await loadSettings());
        const response = await client.field(uri, current.field);
        setAnswer(current.field, fromFieldValue(current, response.value));
      } catch (e) {
        setFieldError(fieldErrorMessage(e instanceof ApiError ? e.code : 'upstream_failed'));
      } finally {
        setBusy(false);
      }
    })();
  }, [recorder, step]);

  async function toggleRecord() {
    if (recorder.state === 'recording') {
      await recorder.stop();
      return;
    }
    setFieldError(null);
    await recorder.start();
  }

  function go(delta: number) {
    setFieldError(null);
    setFormError(null);
    setIndex((i) => i + delta);
  }

  async function save(final: Answers) {
    const problem = validateAnswers(final);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    const id = await createPerson(db, toNewPerson(final), new Date());
    await syncDates(db);
    router.replace(`/person/${id}`);
  }

  function skip() {
    const cleared = { ...answers, [step.field]: step.kind === 'birthday' ? EMPTY_BIRTHDAY : '' } as Answers;
    setAnswers(cleared);
    if (last) {
      void save(cleared);
    } else {
      go(1);
    }
  }

  const birthday = answers.birthday;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text testID="step-counter">{`${index + 1} of ${STEPS.length}`}</Text>
      <Text testID="step-prompt" style={{ fontSize: 22 }}>
        {step.prompt}
      </Text>

      {recorder.permissionDenied ? (
        <View style={{ gap: 6 }}>
          <Text testID="mic-denied">Microphone access is off</Text>
          <Button testID="open-mic-settings" title="Open Settings" onPress={() => Linking.openSettings()} />
        </View>
      ) : (
        <Button
          testID="record-button"
          title={recorder.state === 'recording' ? 'Stop' : 'Record'}
          disabled={busy || saving}
          onPress={toggleRecord}
        />
      )}
      {busy && <ActivityIndicator testID="field-busy" />}
      {fieldError && <Text testID="field-error">{fieldError}</Text>}

      {step.kind === 'birthday' ? (
        <View style={{ gap: 6 }}>
          <TextInput
            testID="birthday-month"
            value={birthday.month}
            onChangeText={(month) => setAnswer('birthday', { ...birthday, month })}
            placeholder="Month"
            keyboardType="number-pad"
            style={inputStyle}
          />
          <TextInput
            testID="birthday-day"
            value={birthday.day}
            onChangeText={(day) => setAnswer('birthday', { ...birthday, day })}
            placeholder="Day"
            keyboardType="number-pad"
            style={inputStyle}
          />
          <TextInput
            testID="birthday-year"
            value={birthday.year}
            onChangeText={(year) => setAnswer('birthday', { ...birthday, year })}
            placeholder="Year (optional)"
            keyboardType="number-pad"
            style={inputStyle}
          />
        </View>
      ) : (
        <TextInput
          testID="answer-input"
          value={answers[step.field] as string}
          onChangeText={(text) => setAnswer(step.field, text)}
          placeholder={step.kind === 'list' ? 'Separate with commas' : step.label}
          style={inputStyle}
        />
      )}

      {formError && <Text testID="form-error">{formError}</Text>}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {index > 0 && <Button testID="back-button" title="Back" disabled={locked} onPress={() => go(-1)} />}
        {index > 0 && <Button testID="skip-button" title="Skip" disabled={locked} onPress={skip} />}
        {last ? (
          <Button testID="save-button" title="Save" disabled={locked} onPress={() => save(answers)} />
        ) : (
          <Button
            testID="next-button"
            title="Next"
            disabled={locked || (index === 0 && answers.name.trim() === '')}
            onPress={() => go(1)}
          />
        )}
      </View>
    </ScrollView>
  );
}
