package gifts_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/gifts"
	"github.com/tahardi/little-things/backend/internal/model"
)

var errBoom = errors.New("boom")

type fakeClient struct {
	system string
	user   string
	reply  any
	err    error
}

func (f *fakeClient) Structured(_ context.Context, system string, user string, _ map[string]any, out any) error {
	f.system, f.user = system, user
	if f.err != nil {
		return f.err
	}
	encoded, err := json.Marshal(f.reply)
	if err != nil {
		return err
	}
	return json.Unmarshal(encoded, out)
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
			generator := gifts.NewGenerator(&fakeClient{reply: tc.reply, err: tc.err})

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
		client := &fakeClient{reply: model.GiftsResponse{Ideas: ideas(5)}}
		generator := gifts.NewGenerator(client)

		// when
		_, err := generator.Generate(context.Background(), request())

		// then
		require.NoError(t, err)
		assert.Contains(t, client.user, `"gifts_given":["whale print"]`)
		assert.Contains(t, client.user, `"gift_ideas":["custom book stamp"]`)
		assert.Contains(t, client.user, `"occasion":"birthday"`)
		assert.Contains(t, client.user, "pottery")
		assert.Contains(t, client.system, "Never suggest anything in gifts_given or gift_ideas")
	})
}
