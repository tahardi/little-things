package live_test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/gifts"
	"github.com/tahardi/little-things/backend/internal/model"
)

func TestGenerator_Generate(t *testing.T) {
	// given
	generator := gifts.NewGenerator(claude(t))
	req := model.GiftsRequest{
		Name:       "Margaret Lin",
		Interests:  []string{"open water swimming", "nautical themes", "arts and crafts"},
		GiftIdeas:  []string{"custom book stamp"},
		GiftsGiven: []string{"whale print"},
		Notes:      []string{"Getting into pottery."},
	}

	// when
	got, err := generator.Generate(context.Background(), req)

	// then
	require.NoError(t, err)
	require.Len(t, got.Ideas, 5)
	for _, idea := range got.Ideas {
		assert.NotEqual(t, "whale print", strings.ToLower(idea.Text))
		assert.NotEqual(t, "custom book stamp", strings.ToLower(idea.Text))
		assert.NotEmpty(t, idea.Why)
	}
}
