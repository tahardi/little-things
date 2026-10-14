import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';

import { DateForm } from '@/components/DateForm';
import { ItemList } from '@/components/ItemList';
import { formatMonthDay, localIsoDate } from '@/dates/format';
import { syncDates } from '@/dates/sync';
import { addDate, deleteDate, setBirthday, updateDate } from '@/db/dates';
import { useDb } from '@/db/DbProvider';
import { displayName as toDisplayName } from '@/people/displayName';
import { addGiftGiven, addGiftIdea, markGiven, removeGiftGiven, removeGiftIdea } from '@/db/gifts';
import { addNote } from '@/db/notes';
import {
  addInterest,
  addNickname,
  deletePerson,
  getPersonDetail,
  removeInterest,
  removeNickname,
  updatePerson,
} from '@/db/people';
import type { DateRow, NewDate, Person, PersonDetail } from '@/db/types';

type FieldKey = 'name' | 'preferredName' | 'relationship' | 'address' | 'phone';
type Fields = Record<FieldKey, string>;
type Editing = { kind: 'birthday' | 'other'; row: DateRow | null } | null;

const FIELDS: { key: FieldKey; label: string; testID: string }[] = [
  { key: 'name', label: 'Name', testID: 'field-name' },
  { key: 'preferredName', label: 'Preferred name', testID: 'field-preferred-name' },
  { key: 'relationship', label: 'Relationship', testID: 'field-relationship' },
  { key: 'address', label: 'Address', testID: 'field-address' },
  { key: 'phone', label: 'Phone', testID: 'field-phone' },
];

const inputStyle = { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 };
const headingStyle = { fontSize: 18, fontWeight: '600' as const };
const rowStyle = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 8 };

function toFields(person: Person): Fields {
  return {
    name: person.name,
    preferredName: person.preferredName ?? '',
    relationship: person.relationship ?? '',
    address: person.address ?? '',
    phone: person.phone ?? '',
  };
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function describeDate(date: DateRow): string {
  const when = formatMonthDay(date.month, date.day, date.year);
  if (date.kind === 'birthday') {
    return `Birthday: ${when}`;
  }
  return `${date.label}: ${when} (${date.recurring ? 'yearly' : 'once'})`;
}

export default function PersonScreen() {
  const db = useDb();
  const personId = Number(useLocalSearchParams<{ id: string }>().id);
  const [detail, setDetail] = useState<PersonDetail | null | undefined>(undefined);
  const [fields, setFields] = useState<Fields | null>(null);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [given, setGiven] = useState({ text: '', occasion: '' });

  const reload = useCallback(async () => {
    const next = await getPersonDetail(db, personId);
    setDetail(next);
    setFields((current) => current ?? (next ? toFields(next) : null));
  }, [db, personId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function run(action: () => Promise<unknown>, datesChanged: boolean): Promise<void> {
    await action();
    if (datesChanged) {
      await syncDates(db);
    }
    await reload();
  }

  async function saveFields() {
    if (!fields || fields.name.trim() === '') {
      setFieldsError('Name is required');
      return;
    }
    setFieldsError(null);
    const patch = {
      name: fields.name.trim(),
      preferredName: orNull(fields.preferredName),
      relationship: orNull(fields.relationship),
      address: orNull(fields.address),
      phone: orNull(fields.phone),
    };
    setFields(null);
    await run(() => updatePerson(db, personId, patch, new Date()), true);
  }

  async function saveDate(date: NewDate) {
    const target = editing;
    setEditing(null);
    if (date.kind === 'birthday') {
      await run(() => setBirthday(db, personId, { month: date.month, day: date.day, year: date.year }), true);
    } else if (target?.row) {
      const id = target.row.id;
      await run(() => updateDate(db, id, date), true);
    } else {
      await run(() => addDate(db, personId, date), true);
    }
  }

  async function addGiven() {
    const now = new Date();
    await run(
      () => addGiftGiven(db, personId, given.text.trim(), localIsoDate(now), orNull(given.occasion), now),
      false,
    );
    setGiven({ text: '', occasion: '' });
  }

  async function addTypedNote() {
    await run(() => addNote(db, personId, noteText.trim(), new Date(), null), false);
    setNoteText('');
  }

  async function confirmDelete() {
    await deletePerson(db, personId);
    await syncDates(db);
    router.replace('/');
  }

  if (detail === undefined) {
    return null;
  }
  if (detail === null) {
    return <Text testID="person-not-found">Person not found</Text>;
  }

  const displayName = toDisplayName(detail);
  const birthday = detail.dates.find((d) => d.kind === 'birthday') ?? null;
  const otherDates = detail.dates.filter((d) => d.kind === 'other');

  function dateRow(date: DateRow) {
    return (
      <View key={date.id} style={rowStyle}>
        <Text testID={`date-${date.id}`}>{describeDate(date)}</Text>
        <Button
          testID={`edit-date-${date.id}`}
          title="Edit"
          onPress={() => setEditing({ kind: date.kind, row: date })}
        />
        <Button
          testID={`delete-date-${date.id}`}
          title="Delete"
          onPress={() => run(() => deleteDate(db, date.id), true)}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text testID="person-title" style={{ fontSize: 24, fontWeight: '600' }}>
        {displayName}
      </Text>

      {FIELDS.map((field) => (
        <View key={field.key} style={{ gap: 4 }}>
          <Text>{field.label}</Text>
          <TextInput
            testID={field.testID}
            value={fields?.[field.key] ?? ''}
            onChangeText={(value) => setFields((current) => (current ? { ...current, [field.key]: value } : current))}
            style={inputStyle}
          />
        </View>
      ))}
      {fieldsError && <Text testID="fields-error">{fieldsError}</Text>}
      <Button testID="save-fields" title="Save changes" onPress={saveFields} />
      <Button testID="gift-ideas-button" title="Gift ideas" onPress={() => router.push(`/person/${personId}/gifts`)} />

      <ItemList
        title="Nicknames"
        testPrefix="nickname"
        items={detail.nicknames}
        onAdd={(text) => run(() => addNickname(db, personId, text), false)}
        onRemove={(id) => run(() => removeNickname(db, id), false)}
      />
      <ItemList
        title="Interests"
        testPrefix="interest"
        items={detail.interests}
        onAdd={(text) => run(() => addInterest(db, personId, text), false)}
        onRemove={(id) => run(() => removeInterest(db, id), false)}
      />
      <ItemList
        title="Gift ideas"
        testPrefix="gift-idea"
        items={detail.giftIdeas}
        onAdd={(text) => run(() => addGiftIdea(db, personId, text, 'manual', new Date()), false)}
        onRemove={(id) => run(() => removeGiftIdea(db, id), false)}
        extra={{
          label: 'Mark as given',
          testPrefix: 'mark-given',
          onPress: (id) => {
            const now = new Date();
            return run(() => markGiven(db, id, localIsoDate(now), now), false);
          },
        }}
      />

      <Text style={headingStyle}>Gifts given</Text>
      {detail.giftsGiven.map((gift) => (
        <View key={gift.id} style={rowStyle}>
          <Text testID={`gift-given-${gift.id}`}>
            {[gift.text, gift.givenOn, gift.occasion].filter((part) => part).join(' · ')}
          </Text>
          <Button
            testID={`remove-gift-given-${gift.id}`}
            title="Remove"
            onPress={() => run(() => removeGiftGiven(db, gift.id), false)}
          />
        </View>
      ))}
      <TextInput
        testID="add-gift-given-input"
        value={given.text}
        onChangeText={(text) => setGiven({ ...given, text })}
        placeholder="Gift"
        style={inputStyle}
      />
      <TextInput
        testID="add-gift-given-occasion"
        value={given.occasion}
        onChangeText={(occasion) => setGiven({ ...given, occasion })}
        placeholder="Occasion (optional)"
        style={inputStyle}
      />
      <Button testID="add-gift-given" title="Add gift given" disabled={given.text.trim() === ''} onPress={addGiven} />

      <Text style={headingStyle}>Dates</Text>
      {birthday ? (
        dateRow(birthday)
      ) : (
        <Button
          testID="add-birthday"
          title="Add birthday"
          onPress={() => setEditing({ kind: 'birthday', row: null })}
        />
      )}
      {otherDates.map(dateRow)}
      <Button testID="add-date" title="Add date" onPress={() => setEditing({ kind: 'other', row: null })} />
      {editing && (
        <DateForm
          key={editing.row?.id ?? `new-${editing.kind}`}
          kind={editing.kind}
          initial={editing.row}
          onSave={saveDate}
          onCancel={() => setEditing(null)}
        />
      )}

      <Text style={headingStyle}>Notes</Text>
      <TextInput
        testID="add-note-input"
        value={noteText}
        onChangeText={setNoteText}
        placeholder="Add a note"
        multiline
        style={inputStyle}
      />
      <Button testID="add-note" title="Add note" disabled={noteText.trim() === ''} onPress={addTypedNote} />
      {detail.notes.map((note) => (
        <Text key={note.id} testID={`note-${note.id}`}>
          {`${localIsoDate(new Date(note.createdAt))}: ${note.text}`}
        </Text>
      ))}

      {confirmingDelete ? (
        <View style={{ gap: 6 }}>
          <Text testID="confirm-delete-text">{`Delete ${displayName} and everything about them?`}</Text>
          <Button testID="confirm-delete" title="Delete" color="#c00" onPress={confirmDelete} />
          <Button testID="cancel-delete" title="Cancel" onPress={() => setConfirmingDelete(false)} />
        </View>
      ) : (
        <Button testID="delete-person" title="Delete person" color="#c00" onPress={() => setConfirmingDelete(true)} />
      )}
    </ScrollView>
  );
}
