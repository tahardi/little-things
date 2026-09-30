package transcribe

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	fakeFFmpegOK   = "#!/bin/sh\nfor a; do last=$a; done\ncp \"$3\" \"$last\"\n"
	fakeFFmpegFail = "#!/bin/sh\necho 'bad input' >&2\nexit 1\n"
	fakeWhisperOK  = "#!/bin/sh\nprintf '  Maggie is getting\\n into pottery.  \\n'\necho 'log line' >&2\n"
	fakeWhisperBad = "#!/bin/sh\necho 'model missing' >&2\nexit 1\n"
)

func writeScript(t *testing.T, dir string, name string, body string) string {
	t.Helper()
	root, err := os.OpenRoot(dir)
	require.NoError(t, err)
	defer root.Close()
	f, err := root.OpenFile(name, os.O_CREATE|os.O_WRONLY, 0o700)
	require.NoError(t, err)
	_, err = f.WriteString(body)
	require.NoError(t, err)
	require.NoError(t, f.Close())
	return filepath.Join(dir, name)
}

func TestWhisper_Transcribe(t *testing.T) {
	tests := []struct {
		name      string
		ffmpeg    string
		whisper   string
		cancelCtx bool
		want      string
		wantErr   error
	}{
		{
			name:    "happy path - trimmed and joined",
			ffmpeg:  fakeFFmpegOK,
			whisper: fakeWhisperOK,
			want:    "Maggie is getting into pottery.",
		},
		{
			name:    "error - whisper fails",
			ffmpeg:  fakeFFmpegOK,
			whisper: fakeWhisperBad,
			wantErr: ErrRunning,
		},
		{
			name:    "error - ffmpeg fails",
			ffmpeg:  fakeFFmpegFail,
			whisper: fakeWhisperOK,
			wantErr: ErrRunning,
		},
		{
			name:      "error - context canceled",
			ffmpeg:    fakeFFmpegOK,
			whisper:   fakeWhisperOK,
			cancelCtx: true,
			wantErr:   context.Canceled,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			bin := t.TempDir()
			tmp := t.TempDir()
			audio := filepath.Join(t.TempDir(), "clip.m4a")
			require.NoError(t, os.WriteFile(audio, []byte("audio"), 0o600))
			w := &Whisper{
				ffmpegBin:  writeScript(t, bin, "ffmpeg", tc.ffmpeg),
				whisperBin: writeScript(t, bin, "whisper-cli", tc.whisper),
				modelPath:  "model.bin",
				tempDir:    tmp,
			}
			ctx, cancel := context.WithCancel(t.Context())
			if tc.cancelCtx {
				cancel()
			}
			defer cancel()

			// when
			got, err := w.Transcribe(ctx, audio)

			// then
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.want, got)
			}
			entries, err := os.ReadDir(tmp)
			require.NoError(t, err)
			assert.Empty(t, entries)
		})
	}
}
