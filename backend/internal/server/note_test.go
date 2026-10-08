package server_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/server"
	"github.com/tahardi/little-things/backend/mocks"
)

func TestServer_Note(t *testing.T) {
	audio := []byte("fake audio")
	peopleJSON := `[{"id":1,"name":"Margaret Lin","preferred_name":null,"nicknames":["Mags"],` +
		`"relationship":"sister-in-law"}]`
	relationship := "sister-in-law"
	people := []model.Person{
		{ID: 1, Name: "Margaret Lin", Nicknames: []string{"Mags"}, Relationship: &relationship},
	}
	pottery := "pottery"
	result := model.NoteResult{
		Matches: []model.Match{{
			PersonID: 1,
			Note:     "Getting into pottery.",
			Changes:  []model.Change{{Type: model.ChangeAddInterest, Text: &pottery}},
		}},
		Unknown: []model.Unknown{},
		Notes:   "",
	}

	tests := []struct {
		name       string
		fields     map[string]string
		audio      []byte
		setup      func(tr *mocks.Transcriber, ne *mocks.NoteExtractor)
		wantStatus int
		wantCode   string
		wantBody   string
	}{
		{
			name:   "happy path - returns matches",
			fields: map[string]string{"people": peopleJSON},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, ne *mocks.NoteExtractor) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).
					Return("Mags is into pottery.", nil)
				ne.EXPECT().Extract(mock.Anything, "Mags is into pottery.", people).Return(result, nil)
			},
			wantStatus: http.StatusOK,
			wantBody: `{"transcript":"Mags is into pottery.","matches":[{"person_id":1,` +
				`"note":"Getting into pottery.","changes":[{"type":"add_interest","text":"pottery","label":null,` +
				`"month":null,"day":null,"year":null,"recurring":null,"given_on":null,"occasion":null}]}],` +
				`"unknown":[],"notes":""}`,
		},
		{
			name:   "happy path - empty people list",
			fields: map[string]string{"people": "[]"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, ne *mocks.NoteExtractor) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("Dave fishes.", nil)
				ne.EXPECT().Extract(mock.Anything, "Dave fishes.", []model.Person{}).Return(model.NoteResult{
					Matches: []model.Match{},
					Unknown: []model.Unknown{{Name: "Dave", Text: "Fishes."}},
				}, nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"transcript":"Dave fishes.","matches":[],"unknown":[{"name":"Dave","text":"Fishes."}],"notes":""}`,
		},
		{
			name:       "error - missing people",
			audio:      audio,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:       "error - people not json",
			fields:     map[string]string{"people": "not json"},
			audio:      audio,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:       "error - missing audio",
			fields:     map[string]string{"people": "[]"},
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:   "error - empty transcript",
			fields: map[string]string{"people": "[]"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, _ *mocks.NoteExtractor) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("", nil)
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantCode:   "no_speech",
		},
		{
			name:   "error - extractor fails",
			fields: map[string]string{"people": "[]"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, ne *mocks.NoteExtractor) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("hello", nil)
				ne.EXPECT().Extract(mock.Anything, "hello", []model.Person{}).Return(model.NoteResult{}, errBoom)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:   "error - invalid model response",
			fields: map[string]string{"people": "[]"},
			audio:  audio,
			setup: func(tr *mocks.Transcriber, ne *mocks.NoteExtractor) {
				tr.EXPECT().Transcribe(mock.Anything, mock.AnythingOfType("string")).Return("hello", nil)
				ne.EXPECT().Extract(mock.Anything, "hello", []model.Person{}).
					Return(model.NoteResult{}, llm.ErrInvalidResponse)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:       "error - upload too large",
			fields:     map[string]string{"people": "[]"},
			audio:      tooBig(),
			wantStatus: http.StatusRequestEntityTooLarge,
			wantCode:   "payload_too_large",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			tr := mocks.NewTranscriber(t)
			ne := mocks.NewNoteExtractor(t)
			if tc.setup != nil {
				tc.setup(tr, ne)
			}
			req := multipartRequest(t, "/note", tc.fields, tc.audio)

			// when
			rec := serve(server.Deps{Transcriber: tr, Notes: ne}, req)

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
}
