import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';

export type ItemListProps = {
  title: string;
  testPrefix: string;
  items: { id: number; text: string }[];
  onAdd: (text: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  extra?: { label: string; testPrefix: string; onPress: (id: number) => Promise<void> };
};

export function ItemList({ title, testPrefix, items, onAdd, onRemove, extra }: ItemListProps) {
  const [text, setText] = useState('');

  async function add() {
    await onAdd(text.trim());
    setText('');
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>{title}</Text>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text testID={`${testPrefix}-${item.id}`}>{item.text}</Text>
          {extra && (
            <Button
              testID={`${extra.testPrefix}-${item.id}`}
              title={extra.label}
              onPress={() => extra.onPress(item.id)}
            />
          )}
          <Button testID={`remove-${testPrefix}-${item.id}`} title="Remove" onPress={() => onRemove(item.id)} />
        </View>
      ))}
      <TextInput
        testID={`add-${testPrefix}-input`}
        value={text}
        onChangeText={setText}
        placeholder={`Add to ${title.toLowerCase()}`}
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6 }}
      />
      <Button testID={`add-${testPrefix}`} title="Add" disabled={text.trim() === ''} onPress={add} />
    </View>
  );
}
