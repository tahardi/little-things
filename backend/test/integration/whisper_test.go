package integration_test

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/transcribe"
)

func TestWhisper_Transcribe(t *testing.T) {
	// given
	whisperBin := os.Getenv("WHISPER_BIN")
	modelPath := os.Getenv("WHISPER_MODEL")
	if whisperBin == "" || modelPath == "" {
		if os.Getenv("CI") == "" {
			t.Skip("set WHISPER_BIN and WHISPER_MODEL (make whisper-build whisper-model)")
		}
		t.Fatal("WHISPER_BIN and WHISPER_MODEL must be set in CI")
	}
	w := transcribe.NewWhisper("ffmpeg", whisperBin, modelPath, t.TempDir())

	// when
	got, err := w.Transcribe(t.Context(), "../testdata/maggie-pottery.m4a")

	// then
	require.NoError(t, err)
	got = strings.ToLower(got)
	assert.Contains(t, got, "pottery")
	assert.Contains(t, got, "birthday")
}
