package live_test

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/field"
	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
)

func claude(t *testing.T) *llm.Anthropic {
	t.Helper()
	key := os.Getenv("ANTHROPIC_API_KEY")
	if key == "" {
		t.Skip("ANTHROPIC_API_KEY not set")
	}
	return llm.NewAnthropic(key)
}

func TestParser_Parse(t *testing.T) {
	parser := field.NewParser(claude(t))

	t.Run("happy path - birthday without year", func(t *testing.T) {
		// given
		transcript := "Her birthday is March third."

		// when
		raw, err := parser.Parse(context.Background(), model.FieldBirthday, transcript)

		// then
		require.NoError(t, err)
		var got model.Birthday
		require.NoError(t, json.Unmarshal(raw, &got))
		assert.Equal(t, model.Birthday{Month: 3, Day: 3}, got)
	})

	t.Run("happy path - spoken phone number becomes digits", func(t *testing.T) {
		// given
		transcript := "nine seven three, five five five, one two one two"

		// when
		raw, err := parser.Parse(context.Background(), model.FieldPhone, transcript)

		// then
		require.NoError(t, err)
		var got string
		require.NoError(t, json.Unmarshal(raw, &got))
		digits := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, got)
		assert.Equal(t, "9735551212", digits)
	})

	t.Run("error - impossible date", func(t *testing.T) {
		// given
		transcript := "Her birthday is February thirtieth."

		// when
		_, err := parser.Parse(context.Background(), model.FieldBirthday, transcript)

		// then
		assert.ErrorIs(t, err, field.ErrUnreadableDate)
	})
}
