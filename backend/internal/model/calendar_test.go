package model_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
)

func TestCalendarFixtures_RoundTrip(t *testing.T) {
	tests := []struct {
		name string
		file string
		into func() any
	}{
		{"calendar request", "calendar-request.json", func() any { return &model.CalendarRequest{} }},
		{"calendar response", "calendar-response.json", func() any { return &model.CalendarResponse{} }},
		{
			"error calendar not configured",
			"error-calendar-not-configured.json",
			func() any { return &model.ErrorResponse{} },
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			original, err := os.ReadFile(filepath.Join("..", "..", "..", "api", "testdata", tt.file))
			require.NoError(t, err)
			got := tt.into()

			// when
			decoder := json.NewDecoder(bytes.NewReader(original))
			decoder.DisallowUnknownFields()
			require.NoError(t, decoder.Decode(got))
			reencoded, err := json.Marshal(got)
			require.NoError(t, err)

			// then
			assert.JSONEq(t, string(original), string(reencoded))
		})
	}
}
