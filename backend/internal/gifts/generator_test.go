package gifts_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/gifts"
	"github.com/tahardi/little-things/backend/internal/model"
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

func ideas(n int) []model.GiftIdea {
	out := make([]model.GiftIdea, n)
	for i := range out {
		out[i] = model.GiftIdea{Text: " idea ", Why: " because "}
	}
	return out
}

func request() model.GiftsRequest {
	occasion := "birthday"
	return model.GiftsRequest{
		Name:       "Margaret Lin",
		Interests:  []string{"swimming", "nautical themes"},
		GiftIdeas:  []string{"custom book stamp"},
		GiftsGiven: []string{"whale print"},
		Notes:      []string{"Getting into pottery."},
		Occasion:   &occasion,
	}
}

func TestGenerator_Generate(t *testing.T) {
	tests := []struct {
		name    string
		reply   model.GiftsResponse
		err     error
		want    model.GiftsResponse
		wantErr error
	}{
		{
			name:  "happy path - five trimmed ideas",
			reply: model.GiftsResponse{Ideas: ideas(5)},
			want: model.GiftsResponse{Ideas: []model.GiftIdea{
				{Text: "idea", Why: "because"},
				{Text: "idea", Why: "because"},
				{Text: "idea", Why: "because"},
				{Text: "idea", Why: "because"},
				{Text: "idea", Why: "because"},
			}},
		},
		{name: "error - four ideas", reply: model.GiftsResponse{Ideas: ideas(4)}, wantErr: gifts.ErrWrongIdeaCount},
		{name: "error - six ideas", reply: model.GiftsResponse{Ideas: ideas(6)}, wantErr: gifts.ErrWrongIdeaCount},
		{
			name:    "error - blank idea does not count",
			reply:   model.GiftsResponse{Ideas: append(ideas(4), model.GiftIdea{Text: "  ", Why: "x"})},
			wantErr: gifts.ErrWrongIdeaCount,
		},
		{name: "error - client fails", err: errBoom, wantErr: errBoom},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			client, _ := newClient(t, tc.reply, tc.err)
			generator := gifts.NewGenerator(client)

			// when
			got, err := generator.Generate(context.Background(), request())

			// then
			if tc.wantErr != nil {
				assert.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}

	t.Run("happy path - prompt carries exclusions and occasion", func(t *testing.T) {
		// given
		client, got := newClient(t, model.GiftsResponse{Ideas: ideas(5)}, nil)
		generator := gifts.NewGenerator(client)

		// when
		_, err := generator.Generate(context.Background(), request())

		// then
		require.NoError(t, err)
		assert.Contains(t, got.user, `"gifts_given":["whale print"]`)
		assert.Contains(t, got.user, `"gift_ideas":["custom book stamp"]`)
		assert.Contains(t, got.user, `"occasion":"birthday"`)
		assert.Contains(t, got.user, "pottery")
		assert.Contains(t, got.system, "Never suggest anything in gifts_given or gift_ideas")
	})
}
