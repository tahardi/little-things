import { Directory, File, Paths } from 'expo-file-system';

export function persistClip(tempUri: string, now: Date): string {
  const dir = new Directory(Paths.document, 'clips');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `clip-${now.getTime()}.m4a`);
  new File(tempUri).copy(dest);
  return dest.uri;
}

export function deleteClipFile(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
