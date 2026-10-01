package config_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/config"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		want    config.Config
		wantErr error
	}{
		{
			name: "happy path - all vars set",
			env: map[string]string{
				"ANTHROPIC_API_KEY": "sk-test",
				"LITTLETHINGS_KEY":  "secret",
				"WHISPER_BIN":       "/bin/whisper",
				"WHISPER_MODEL":     "/models/ggml-base.en.bin",
				"FFMPEG_BIN":        "/bin/ffmpeg",
				"LISTEN_ADDR":       "127.0.0.1:9000",
			},
			want: config.Config{
				AnthropicAPIKey: "sk-test",
				AppKey:          "secret",
				WhisperBin:      "/bin/whisper",
				WhisperModel:    "/models/ggml-base.en.bin",
				FFmpegBin:       "/bin/ffmpeg",
				ListenAddr:      "127.0.0.1:9000",
			},
		},
		{
			name: "happy path - defaults applied",
			env:  map[string]string{"LITTLETHINGS_KEY": "secret"},
			want: config.Config{
				AppKey:     "secret",
				ListenAddr: "127.0.0.1:8081",
				WhisperBin: "whisper-cli",
				FFmpegBin:  "ffmpeg",
			},
		},
		{
			name:    "error - key empty",
			env:     map[string]string{"LITTLETHINGS_KEY": ""},
			wantErr: config.ErrMissingKey,
		},
		{
			name:    "error - key whitespace",
			env:     map[string]string{"LITTLETHINGS_KEY": "   "},
			wantErr: config.ErrMissingKey,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			getenv := func(k string) string { return tc.env[k] }

			// when
			got, err := config.Load(getenv)

			// then
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}
