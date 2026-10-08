import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareFile(fileName: string, contents: string, uti: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, { UTI: uti });
}
