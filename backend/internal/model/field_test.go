package model_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/tahardi/little-things/backend/internal/model"
)

func TestField_Valid(t *testing.T) {
	tests := []struct {
		name  string
		field model.Field
		want  bool
	}{
		{"name", model.FieldName, true},
		{"preferred name", model.FieldPreferredName, true},
		{"nicknames", model.FieldNicknames, true},
		{"relationship", model.FieldRelationship, true},
		{"birthday", model.FieldBirthday, true},
		{"address", model.FieldAddress, true},
		{"phone", model.FieldPhone, true},
		{"interests", model.FieldInterests, true},
		{"empty", model.Field(""), false},
		{"unknown", model.Field("email"), false},
		{"wrong case", model.Field("Name"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// given
			field := tt.field

			// when
			got := field.Valid()

			// then
			assert.Equal(t, tt.want, got)
		})
	}
}
