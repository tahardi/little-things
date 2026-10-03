package note_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/note"
)

var errBoom = errors.New("boom")

type fakeClient struct {
	system string
	user   string
	schema map[string]any
	reply  any
	err    error
}

func (f *fakeClient) Structured(_ context.Context, system string, user string, schema map[string]any, out any) error {
	f.system, f.user, f.schema = system, user, schema
	if f.err != nil {
		return f.err
	}
	encoded, err := json.Marshal(f.reply)
	if err != nil {
		return err
	}
	return json.Unmarshal(encoded, out)
}

func TestExtractor_Extract(t *testing.T) {
	pottery := change(model.ChangeAddInterest)
	pottery.Text = new("pottery")
	transcript := "Mags is getting into pottery. My sister in law also wants a wheel."

	t.Run("happy path - returns validated result", func(t *testing.T) {
		// given
		client := &fakeClient{reply: model.NoteResult{
			Matches: []model.Match{{PersonID: 1, Note: "Getting into pottery.", Changes: []model.Change{pottery}}},
		}}
		extractor := note.NewExtractor(client)

		// when
		got, err := extractor.Extract(context.Background(), transcript, people())

		// then
		require.NoError(t, err)
		assert.Equal(t, model.NoteResult{
			Matches: []model.Match{{PersonID: 1, Note: "Getting into pottery.", Changes: []model.Change{pottery}}},
			Unknown: []model.Unknown{},
		}, got)
	})

	t.Run("happy path - prompt carries names nicknames relationships and transcript", func(t *testing.T) {
		// given
		client := &fakeClient{reply: model.NoteResult{}}
		extractor := note.NewExtractor(client)

		// when
		_, err := extractor.Extract(context.Background(), transcript, people())

		// then
		require.NoError(t, err)
		assert.Contains(t, client.user, `"name":"Margaret Lin"`)
		assert.Contains(t, client.user, `"preferred_name":"Maggie"`)
		assert.Contains(t, client.user, `"nicknames":["Mags"]`)
		assert.Contains(t, client.user, `"relationship":"sister-in-law"`)
		assert.Contains(t, client.user, `"id":2`)
		assert.Contains(t, client.user, transcript)
		assert.Contains(t, client.system, "Never invent an id")
		assert.Equal(t, "object", client.schema["type"])
	})

	t.Run("happy path - invented id moves to unknown", func(t *testing.T) {
		// given
		client := &fakeClient{reply: model.NoteResult{
			Matches: []model.Match{{PersonID: 42, Note: "Likes fly fishing."}},
		}}
		extractor := note.NewExtractor(client)

		// when
		got, err := extractor.Extract(context.Background(), transcript, people())

		// then
		require.NoError(t, err)
		assert.Empty(t, got.Matches)
		assert.Equal(t, []model.Unknown{{Name: "person 42", Text: "Likes fly fishing."}}, got.Unknown)
	})

	t.Run("error - client fails", func(t *testing.T) {
		// given
		client := &fakeClient{err: errBoom}
		extractor := note.NewExtractor(client)

		// when
		_, err := extractor.Extract(context.Background(), transcript, people())

		// then
		assert.ErrorIs(t, err, errBoom)
	})
}
