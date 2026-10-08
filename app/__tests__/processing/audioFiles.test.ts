import { persistClip, deleteClipFile } from '@/processing/audioFiles';

const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = `${base}/${name}`;
    }
    create() {
      mockDirs.add(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    copy(dest: { uri: string }) {
      mockFiles.set(dest.uri, mockFiles.get(this.uri) ?? '');
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
});

test('persistClip copies the temp file into the clips directory', () => {
  mockFiles.set('file:///tmp/rec.m4a', 'audio');

  const uri = persistClip('file:///tmp/rec.m4a', new Date(1_700_000_000_000));

  expect(mockDirs.has('file:///docs/clips')).toBe(true);
  expect(uri).toBe('file:///docs/clips/clip-1700000000000.m4a');
  expect(mockFiles.get(uri)).toBe('audio');
});

test('deleteClipFile removes an existing file', () => {
  mockFiles.set('file:///docs/clips/clip-1.m4a', 'audio');

  deleteClipFile('file:///docs/clips/clip-1.m4a');

  expect(mockFiles.has('file:///docs/clips/clip-1.m4a')).toBe(false);
});

test('deleteClipFile ignores a missing file', () => {
  expect(() => deleteClipFile('file:///docs/clips/missing.m4a')).not.toThrow();
});
