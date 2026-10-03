package field_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/field"
	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/mocks"
)

func TestParser_Parse(t *testing.T) {
	tests := []struct {
		name       string
		field      model.Field
		reply      string
		replyErr   error
		want       string
		wantErr    error
		wantSchema string
		noCall     bool
	}{
		{name: "happy path - name trimmed", field: model.FieldName, reply: `{"value":"  Margaret Lin "}`,
			want: `"Margaret Lin"`, wantSchema: "string"},
		{name: "happy path - preferred name", field: model.FieldPreferredName, reply: `{"value":"Maggie"}`,
			want: `"Maggie"`, wantSchema: "string"},
		{name: "happy path - relationship", field: model.FieldRelationship, reply: `{"value":"sister-in-law"}`,
			want: `"sister-in-law"`, wantSchema: "string"},
		{name: "happy path - address", field: model.FieldAddress,
			reply: `{"value":"12 Elm St, Springfield, IL 62701"}`,
			want:  `"12 Elm St, Springfield, IL 62701"`, wantSchema: "string"},
		{name: "happy path - phone", field: model.FieldPhone, reply: `{"value":"555-123-4567"}`,
			want: `"555-123-4567"`, wantSchema: "string"},
		{name: "happy path - nicknames cleaned", field: model.FieldNicknames,
			reply: `{"value":["Maggie"," Mags ","","maggie"]}`, want: `["Maggie","Mags"]`, wantSchema: "array"},
		{name: "happy path - interests empty", field: model.FieldInterests, reply: `{"value":[]}`,
			want: `[]`, wantSchema: "array"},
		{name: "happy path - birthday with year", field: model.FieldBirthday,
			reply: `{"value":{"month":10,"day":11,"year":1994}}`,
			want:  `{"month":10,"day":11,"year":1994}`, wantSchema: "object"},
		{name: "happy path - birthday without year", field: model.FieldBirthday,
			reply: `{"value":{"month":3,"day":3,"year":null}}`,
			want:  `{"month":3,"day":3,"year":null}`, wantSchema: "object"},
		{name: "happy path - birthday feb 29", field: model.FieldBirthday,
			reply: `{"value":{"month":2,"day":29,"year":null}}`,
			want:  `{"month":2,"day":29,"year":null}`, wantSchema: "object"},
		{name: "error - birthday feb 30", field: model.FieldBirthday,
			reply: `{"value":{"month":2,"day":30,"year":null}}`, wantErr: field.ErrUnreadableDate},
		{name: "error - birthday no date", field: model.FieldBirthday,
			reply: `{"value":{"month":null,"day":null,"year":null}}`, wantErr: field.ErrUnreadableDate},
		{name: "error - birthday two digit year", field: model.FieldBirthday,
			reply: `{"value":{"month":10,"day":11,"year":94}}`, wantErr: field.ErrUnreadableDate},
		{name: "error - unknown field", field: model.Field("shoe_size"), wantErr: field.ErrUnknownField, noCall: true},
		{name: "error - model refused", field: model.FieldName, replyErr: llm.ErrRefused, wantErr: llm.ErrRefused},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			client := mocks.NewClient(t)
			var gotUser string
			var gotSchema map[string]any
			if !tc.noCall {
				client.EXPECT().
					Structured(mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					RunAndReturn(func(_ context.Context, _ string, user string, schema map[string]any, out any) error {
						gotUser = user
						gotSchema = schema
						if tc.replyErr != nil {
							return tc.replyErr
						}
						return json.Unmarshal([]byte(tc.reply), out)
					})
			}
			parser := field.NewParser(client)

			// when
			got, err := parser.Parse(t.Context(), tc.field, "spoken answer")

			// then
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.JSONEq(t, tc.want, string(got))
			assert.Contains(t, gotUser, "spoken answer")
			properties, ok := gotSchema["properties"].(map[string]any)
			require.True(t, ok)
			value, ok := properties["value"].(map[string]any)
			require.True(t, ok)
			assert.Equal(t, tc.wantSchema, value["type"])
		})
	}
}
