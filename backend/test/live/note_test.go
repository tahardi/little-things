package live_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/note"
	"github.com/tahardi/little-things/backend/internal/server"
	"github.com/tahardi/little-things/backend/internal/transcribe"
)

func knownPeople() []model.Person {
	relationship := "sister-in-law"
	preferred := "Maggie"
	return []model.Person{
		{ID: 1, Name: "Margaret Lin", PreferredName: &preferred, Nicknames: []string{"Mags"}, Relationship: &relationship},
		{ID: 2, Name: "Sam Ortiz", Nicknames: []string{"Sammy"}},
		{ID: 3, Name: "Priya Nair", Nicknames: []string{}},
	}
}

func hasChange(match model.Match, changeType model.ChangeType, text string) bool {
	for _, c := range match.Changes {
		if c.Type == changeType && (text == "" || (c.Text != nil && strings.Contains(strings.ToLower(*c.Text), text))) {
			return true
		}
	}
	return false
}

func matchFor(result model.NoteResult, personID int64) (model.Match, bool) {
	for _, m := range result.Matches {
		if m.PersonID == personID {
			return m, true
		}
	}
	return model.Match{}, false
}

func TestExtractor_Extract(t *testing.T) {
	// given
	extractor := note.NewExtractor(claude(t))
	transcript := "Mags has been getting really into pottery lately. Sammy's birthday is March third. " +
		"Also my buddy Dave loves fly fishing."

	// when
	got, err := extractor.Extract(context.Background(), transcript, knownPeople())

	// then
	require.NoError(t, err)
	maggie, ok := matchFor(got, 1)
	require.True(t, ok)
	assert.True(t, hasChange(maggie, model.ChangeAddInterest, "pottery"))
	sam, ok := matchFor(got, 2)
	require.True(t, ok)
	require.True(t, hasChange(sam, model.ChangeSetBirthday, ""))
	require.Len(t, got.Unknown, 1)
	assert.Contains(t, got.Unknown[0].Name, "Dave")
}

func TestServer_Note(t *testing.T) {
	// given
	client := claude(t)
	whisperModel := os.Getenv("WHISPER_MODEL")
	if whisperModel == "" {
		t.Skip("WHISPER_MODEL not set")
	}
	handler := server.NewServer(
		"secret",
		server.Deps{
			Transcriber: transcribe.NewWhisper("ffmpeg", "whisper-cli", whisperModel, os.TempDir()),
			Notes:       note.NewExtractor(client),
		},
		slog.New(slog.DiscardHandler),
	)
	httpServer := httptest.NewServer(handler)
	defer httpServer.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	people, err := json.Marshal(knownPeople())
	require.NoError(t, err)
	require.NoError(t, writer.WriteField("people", string(people)))
	part, err := writer.CreateFormFile("audio", "maggie-pottery.m4a")
	require.NoError(t, err)
	clip, err := os.Open("../testdata/maggie-pottery.m4a")
	require.NoError(t, err)
	defer clip.Close()
	_, err = io.Copy(part, clip)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		httpServer.URL+"/note",
		&body,
	)
	require.NoError(t, err)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer secret")

	// when
	resp, err := httpServer.Client().Do(req)

	// then
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var got model.NoteResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&got))
	result := model.NoteResult{Matches: got.Matches}
	maggie, ok := matchFor(result, 1)
	require.True(t, ok)
	assert.True(t, hasChange(maggie, model.ChangeAddInterest, "pottery"))
	sam, ok := matchFor(result, 2)
	require.True(t, ok)
	assert.True(t, hasChange(sam, model.ChangeSetBirthday, ""))
}
