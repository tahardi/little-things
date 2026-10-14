import { useState } from 'react';
import { Button, Switch, Text, TextInput, View } from 'react-native';

import { parseDateDraft, type DateDraft } from '@/dates/draft';
import type { DateKind, DateRow, NewDate } from '@/db/types';

export type DateFormProps = {
  kind: DateKind;
  initial: DateRow | null;
  onSave: (date: NewDate) => void;
  onCancel: () => void;
};

const inputStyle = { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 };

export function DateForm({ kind, initial, onSave, onCancel }: DateFormProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [draft, setDraft] = useState<DateDraft>({
    month: initial ? String(initial.month) : '',
    day: initial ? String(initial.day) : '',
    year: initial?.year ? String(initial.year) : '',
  });
  const [recurring, setRecurring] = useState(initial?.recurring ?? true);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed = parseDateDraft(draft);
    if (!parsed) {
      setError('Enter a real month and day, and a 4-digit year or no year');
      return;
    }
    if (kind === 'other' && label.trim() === '') {
      setError('Label is required');
      return;
    }
    onSave({
      kind,
      label: kind === 'birthday' ? 'Birthday' : label.trim(),
      month: parsed.month,
      day: parsed.day,
      year: parsed.year,
      recurring: kind === 'birthday' ? true : recurring,
    });
  }

  return (
    <View testID="date-form" style={{ gap: 6 }}>
      {kind === 'other' && (
        <TextInput testID="date-label" value={label} onChangeText={setLabel} placeholder="Label" style={inputStyle} />
      )}
      <TextInput
        testID="date-month"
        value={draft.month}
        onChangeText={(month) => setDraft({ ...draft, month })}
        placeholder="Month"
        keyboardType="number-pad"
        style={inputStyle}
      />
      <TextInput
        testID="date-day"
        value={draft.day}
        onChangeText={(day) => setDraft({ ...draft, day })}
        placeholder="Day"
        keyboardType="number-pad"
        style={inputStyle}
      />
      <TextInput
        testID="date-year"
        value={draft.year}
        onChangeText={(year) => setDraft({ ...draft, year })}
        placeholder="Year (optional)"
        keyboardType="number-pad"
        style={inputStyle}
      />
      {kind === 'other' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text>Repeats yearly</Text>
          <Switch testID="date-recurring" value={recurring} onValueChange={setRecurring} />
        </View>
      )}
      {error && <Text testID="date-error">{error}</Text>}
      <Button testID="date-save" title="Save date" onPress={save} />
      <Button testID="date-cancel" title="Cancel" onPress={onCancel} />
    </View>
  );
}
