package integration_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/transcribe"
)

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	root, err := os.OpenRoot(filepath.Dir(path))
	if err != nil {
		return false
	}
	defer root.Close()
	_, err = root.Stat(filepath.Base(path))
	return err == nil
}

func TestWhisper_Transcribe(t *testing.T) {
	// given
	bin := os.Getenv("WHISPER_BIN")
	model := os.Getenv("WHISPER_MODEL")
	if !fileExists(bin) || !fileExists(model) {
		if os.Getenv("CI") == "" {
			t.Skip("whisper not built; run make whisper-build whisper-model")
		}
		t.Fatal("WHISPER_BIN and WHISPER_MODEL must exist in CI")
	}
	t.Setenv("PATH", filepath.Dir(bin)+string(os.PathListSeparator)+os.Getenv("PATH"))
	w := transcribe.NewWhisper(model)

	// when
	got, err := w.Transcribe(t.Context(), "../testdata/maggie-pottery.m4a")

	// then
	require.NoError(t, err)
	lower := strings.ToLower(got)
	assert.Contains(t, lower, "pottery")
	assert.Contains(t, lower, "birthday")
}
