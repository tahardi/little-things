import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import { useDb } from '@/db/DbProvider';
import { listPersonDetails } from '@/db/people';
import { toJson } from '@/export/json';
import { localDate, toMarkdown } from '@/export/markdown';
import { shareFile } from '@/export/share';

export function ExportSection() {
  const db = useDb();
  const [error, setError] = useState('');

  async function run(kind: 'markdown' | 'json') {
    try {
      const now = new Date();
      const day = localDate(now.toISOString());
      if (kind === 'markdown') {
        const contents = toMarkdown(await listPersonDetails(db));
        await shareFile(`little-things-people-${day}.md`, contents, 'net.daringfireball.markdown');
      } else {
        await shareFile(`little-things-${day}.json`, await toJson(db, now), 'public.json');
      }
      setError('');
    } catch (err) {
      setError(`Export failed: ${(err as Error).message}`);
    }
  }

  return (
    <View>
      <Button testID="export-markdown" title="Export Markdown" onPress={() => run('markdown')} />
      <Button testID="export-json" title="Export JSON" onPress={() => run('json')} />
      {error !== '' && <Text testID="export-error">{error}</Text>}
    </View>
  );
}
