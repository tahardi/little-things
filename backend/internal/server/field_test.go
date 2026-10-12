package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/tahardi/little-things/backend/internal/field"
	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/server"
	"github.com/tahardi/little-things/backend/mocks"
)

var errBoom = errors.New("boom")

func TestServer_Field(t *testing.T) {
	audio := []byte("fake audio")
	birthday := json.RawMessage(`{"month":3,"day":3,"year":null}`)

	tests := []struct {
		name       string
		fields     map[string]string
		audio      []byte
		noKey      bool
		setup      func(tr *mocks.Transcriber, fp *mocks.FieldParser)
		wantStatus int
		wantCode   string
		wantBody   string
	}{
		{
			name:   "happy path - birthday",
			fields: map[string]string{"field": "birthday"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, fp *mocks.FieldParser) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return(" March third ", nil)
				fp.EXPECT().Parse(mock.Anything, model.FieldBirthday, "March third").Return(birthday, nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"transcript":"March third","value":{"month":3,"day":3,"year":null}}`,
		},
		{
			name:   "error - empty transcript",
			fields: map[string]string{"field": "birthday"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, _ *mocks.FieldParser) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("   ", nil)
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantCode:   "no_speech",
		},
		{
			name:       "error - unknown field",
			fields:     map[string]string{"field": "email"},
			audio:      audio,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:       "error - missing field",
			audio:      audio,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:       "error - missing audio",
			fields:     map[string]string{"field": "name"},
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:   "error - unreadable date",
			fields: map[string]string{"field": "birthday"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, fp *mocks.FieldParser) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("February thirtieth", nil)
				fp.EXPECT().Parse(mock.Anything, model.FieldBirthday, "February thirtieth").
					Return(nil, field.ErrUnreadableDate)
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantCode:   "unreadable_date",
		},
		{
			name:   "error - parser fails",
			fields: map[string]string{"field": "name"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, fp *mocks.FieldParser) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("Dave", nil)
				fp.EXPECT().Parse(mock.Anything, model.FieldName, "Dave").Return(nil, errBoom)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:   "error - model refused",
			fields: map[string]string{"field": "name"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, fp *mocks.FieldParser) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("Dave", nil)
				fp.EXPECT().Parse(mock.Anything, model.FieldName, "Dave").Return(nil, llm.ErrRefused)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:   "error - transcriber fails",
			fields: map[string]string{"field": "name"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, _ *mocks.FieldParser) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("", errBoom)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:       "error - upload too large",
			fields:     map[string]string{"field": "name"},
			audio:      tooBig(),
			wantStatus: http.StatusRequestEntityTooLarge,
			wantCode:   "payload_too_large",
		},
		{
			name:       "error - no key",
			fields:     map[string]string{"field": "name"},
			audio:      audio,
			noKey:      true,
			wantStatus: http.StatusUnauthorized,
			wantCode:   "unauthorized",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			tr := mocks.NewTranscriber(t)
			fp := mocks.NewFieldParser(t)
			if tc.setup != nil {
				tc.setup(tr, fp)
			}
			req := multipartRequest(t, "/field", tc.fields, tc.audio)
			if tc.noKey {
				req.Header.Del("Authorization")
			}

			// when
			rec := serve(server.Deps{Transcriber: tr, Fields: fp}, req)

			// then
			assert.Equal(t, tc.wantStatus, rec.Code)
			if tc.wantBody != "" {
				assert.JSONEq(t, tc.wantBody, rec.Body.String())
			}
			if tc.wantCode != "" {
				assert.Equal(t, tc.wantCode, errorCode(t, rec))
			}
		})
	}

	t.Run("happy path - temp audio file is removed", func(t *testing.T) {
		// given
		var saved string
		tr := mocks.NewTranscriber(t)
		tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).
			Run(func(_ context.Context, path string) { saved = path }).
			Return("Dave", nil)
		fp := mocks.NewFieldParser(t)
		fp.EXPECT().Parse(mock.Anything, model.FieldName, "Dave").Return(json.RawMessage(`"Dave"`), nil)
		req := multipartRequest(t, "/field", map[string]string{"field": "name"}, audio)

		// when
		rec := serve(server.Deps{Transcriber: tr, Fields: fp}, req)

		// then
		assert.Equal(t, http.StatusOK, rec.Code)
		assert.NotEmpty(t, saved)
		assert.NoFileExists(t, saved)
	})
}
