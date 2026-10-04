package note_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/note"
	"github.com/tahardi/little-things/backend/mocks"
)

var errBoom = errors.New("boom")

type prompt struct {
	system string
	user   string
	schema map[string]any
}

func newClient(t *testing.T, reply any, err error) (*mocks.Client, *prompt) {
	t.Helper()
	got := &prompt{}
	client := mocks.NewClient(t)
	client.EXPECT().
		Structured(mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, system string, user string, schema map[string]any, out any) error {
			got.system, got.user, got.schema = system, user, schema
			if err != nil {
				return err
			}
			encoded, marshalErr := json.Marshal(reply)
			if marshalErr != nil {
				return marshalErr
			}
			return json.Unmarshal(encoded, out)
		})
	return client, got
}

func TestExtractor_Extract(t *testing.T) {
	pottery := change(model.ChangeAddInterest)
	pottery.Text = new("pottery")
	transcript := "Mags is getting into pottery. My sister in law also wants a wheel."

	t.Run("happy path - returns validated result", func(t *testing.T) {
		// given
		client, _ := newClient(t, model.NoteResult{
			Matches: []model.Match{{PersonID: 1, Note: "Getting into pottery.", Changes: []model.Change{pottery}}},
		}, nil)
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
		client, got := newClient(t, model.NoteResult{}, nil)
		extractor := note.NewExtractor(client)

		// when
		_, err := extractor.Extract(context.Background(), transcript, people())

		// then
		require.NoError(t, err)
		assert.Contains(t, got.user, `"name":"Margaret Lin"`)
		assert.Contains(t, got.user, `"preferred_name":"Maggie"`)
		assert.Contains(t, got.user, `"nicknames":["Mags"]`)
		assert.Contains(t, got.user, `"relationship":"sister-in-law"`)
		assert.Contains(t, got.user, `"id":2`)
		assert.Contains(t, got.user, transcript)
		assert.Contains(t, got.system, "Never invent an id")
		assert.Equal(t, "object", got.schema["type"])
	})

	t.Run("happy path - invented id moves to unknown", func(t *testing.T) {
		// given
		client, _ := newClient(t, model.NoteResult{
			Matches: []model.Match{{PersonID: 42, Note: "Likes fly fishing."}},
		}, nil)
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
		client, _ := newClient(t, nil, errBoom)
		extractor := note.NewExtractor(client)

		// when
		_, err := extractor.Extract(context.Background(), transcript, people())

		// then
		assert.ErrorIs(t, err, errBoom)
	})
}
