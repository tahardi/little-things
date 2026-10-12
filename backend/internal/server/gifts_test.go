package server_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/tahardi/little-things/backend/internal/gifts"
	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/server"
	"github.com/tahardi/little-things/backend/mocks"
)

func TestServer_Gifts(t *testing.T) {
	body := []byte(`{"name":"Margaret Lin","preferred_name":null,"relationship":null,"interests":["swimming"],` +
		`"gift_ideas":[],"gifts_given":["whale print"],"notes":[],"occasion":null}`)
	want := model.GiftsRequest{
		Name:       "Margaret Lin",
		Interests:  []string{"swimming"},
		GiftIdeas:  []string{},
		GiftsGiven: []string{"whale print"},
		Notes:      []string{},
	}
	ideas := model.GiftsResponse{Ideas: []model.GiftIdea{{Text: "open water swim buoy", Why: "She swims."}}}

	tests := []struct {
		name       string
		body       []byte
		noKey      bool
		setup      func(gg *mocks.GiftGenerator)
		wantStatus int
		wantCode   string
		wantBody   string
	}{
		{
			name: "happy path - returns ideas",
			body: body,
			setup: func(gg *mocks.GiftGenerator) {
				gg.EXPECT().Generate(mock.Anything, want).Return(ideas, nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"ideas":[{"text":"open water swim buoy","why":"She swims."}]}`,
		},
		{name: "error - not json", body: []byte("nope"), wantStatus: http.StatusBadRequest, wantCode: "bad_request"},
		{
			name:       "error - blank name",
			body:       []byte(`{"name":"  "}`),
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name: "error - generator fails",
			body: body,
			setup: func(gg *mocks.GiftGenerator) {
				gg.EXPECT().Generate(mock.Anything, want).Return(model.GiftsResponse{}, gifts.ErrWrongIdeaCount)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:       "error - body too large",
			body:       append([]byte(`{"name":"`), append(bytes.Repeat([]byte("a"), 2<<20), []byte(`"}`)...)...),
			wantStatus: http.StatusRequestEntityTooLarge,
			wantCode:   "payload_too_large",
		},
		{name: "error - no key", body: body, noKey: true, wantStatus: http.StatusUnauthorized, wantCode: "unauthorized"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			gg := mocks.NewGiftGenerator(t)
			if tc.setup != nil {
				tc.setup(gg)
			}
			req := jsonRequest(t, "/gifts", tc.body)
			if tc.noKey {
				req.Header.Del("Authorization")
			}

			// when
			rec := serve(server.Deps{Gifts: gg}, req)

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
