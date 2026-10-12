import { useEffect, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';

export type RecorderState = 'idle' | 'recording' | 'recorded';

export type Recorder = {
  state: RecorderState;
  uri: string | null;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): void;
  permissionDenied: boolean;
};

export function useRecorder(): Recorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecorderState>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    requestRecordingPermissionsAsync().then((result) => setPermissionDenied(!result.granted));
  }, []);

  async function start() {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setUri(null);
    setState('recording');
  }

  async function stop() {
    await recorder.stop();
    setUri(recorder.uri);
    setState('recorded');
  }

  function reset() {
    setUri(null);
    setState('idle');
  }

  return { state, uri, start, stop, reset, permissionDenied };
}
