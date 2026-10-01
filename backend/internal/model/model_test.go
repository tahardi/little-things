package model_test

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
)

func TestFixtures_RoundTrip(t *testing.T) {
	tests := []struct {
		name string
		file string
		into func() any
	}{
		{
			"health response",
			"../../../api/testdata/health-response.json",
			func() any { return &model.HealthResponse{} },
		},
		{
			"field response phone",
			"../../../api/testdata/field-response-phone.json",
			func() any { return &model.FieldResponse{} },
		},
		{
			"field response interests",
			"../../../api/testdata/field-response-interests.json",
			func() any { return &model.FieldResponse{} },
		},
		{
			"field response birthday",
			"../../../api/testdata/field-response-birthday.json",
			func() any { return &model.FieldResponse{} },
		},
		{
			"note people",
			"../../../api/testdata/note-people.json",
			func() any { return &[]model.Person{} },
		},
		{
			"note response",
			"../../../api/testdata/note-response.json",
			func() any { return &model.NoteResponse{} },
		},
		{
			"gifts request",
			"../../../api/testdata/gifts-request.json",
			func() any { return &model.GiftsRequest{} },
		},
		{
			"gifts response",
			"../../../api/testdata/gifts-response.json",
			func() any { return &model.GiftsResponse{} },
		},
		{
			"error no speech",
			"../../../api/testdata/error-no-speech.json",
			func() any { return &model.ErrorResponse{} },
		},
		{
			"error unreadable date",
			"../../../api/testdata/error-unreadable-date.json",
			func() any { return &model.ErrorResponse{} },
		},
		{
			"error unauthorized",
			"../../../api/testdata/error-unauthorized.json",
			func() any { return &model.ErrorResponse{} },
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			original, err := os.ReadFile(tt.file)
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

func TestFixtures_BirthdayValue(t *testing.T) {
	// given
	original, err := os.ReadFile("../../../api/testdata/field-response-birthday.json")
	require.NoError(t, err)
	var resp model.FieldResponse
	require.NoError(t, json.Unmarshal(original, &resp))

	// when
	var got model.Birthday
	decoder := json.NewDecoder(bytes.NewReader(resp.Value))
	decoder.DisallowUnknownFields()
	err = decoder.Decode(&got)

	// then
	require.NoError(t, err)
	assert.Equal(t, model.Birthday{Month: 10, Day: 11, Year: nil}, got)
}
