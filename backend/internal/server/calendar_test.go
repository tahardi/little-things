package server_test

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/server"
	"github.com/tahardi/little-things/backend/mocks"
)

func TestServer_Calendar(t *testing.T) {
	fixture, err := os.ReadFile(filepath.Join("..", "..", "..", "api", "testdata", "calendar-request.json"))
	require.NoError(t, err)
	notConfigured, err := os.ReadFile(
		filepath.Join("..", "..", "..", "api", "testdata", "error-calendar-not-configured.json"),
	)
	require.NoError(t, err)
	y1994, y2026 := 1994, 2026
	fixtureDates := []model.CalendarDate{
		{ID: 11, Title: "Maggie's birthday", Month: 10, Day: 11, Year: &y1994, Recurring: true},
		{ID: 12, Title: "Sam's birthday", Month: 3, Day: 3, Recurring: true},
		{ID: 13, Title: "Priya: surgery", Month: 11, Day: 20, Year: &y2026},
	}

	tests := []struct {
		name       string
		body       string
		noKey      bool
		noCalendar bool
		setup      func(cs *mocks.CalendarSyncer)
		wantStatus int
		wantCode   string
		wantBody   string
	}{
		{
			name: "happy path - syncs fixture",
			body: string(fixture),
			setup: func(cs *mocks.CalendarSyncer) {
				cs.EXPECT().Sync(mock.Anything, fixtureDates).
					Return(model.CalendarResponse{Created: 2, Updated: 1, Deleted: 1}, nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"created":2,"updated":1,"deleted":1}`,
		},
		{
			name: "happy path - empty list",
			body: `{"dates":[]}`,
			setup: func(cs *mocks.CalendarSyncer) {
				cs.EXPECT().Sync(mock.Anything, []model.CalendarDate{}).
					Return(model.CalendarResponse{Deleted: 3}, nil)
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"created":0,"updated":0,"deleted":3}`,
		},
		{
			name:       "error - not configured",
			body:       string(fixture),
			noCalendar: true,
			wantStatus: http.StatusServiceUnavailable,
			wantBody:   string(notConfigured),
		},
		{name: "error - not json", body: "nope", wantStatus: http.StatusBadRequest, wantCode: "bad_request"},
		{name: "error - missing dates", body: `{}`, wantStatus: http.StatusBadRequest, wantCode: "bad_request"},
		{
			name:       "error - impossible date",
			body:       `{"dates":[{"id":1,"title":"x","month":2,"day":30,"year":null,"recurring":true}]}`,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:       "error - blank title",
			body:       `{"dates":[{"id":1,"title":"  ","month":2,"day":3,"year":null,"recurring":true}]}`,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name:       "error - bad year",
			body:       `{"dates":[{"id":1,"title":"x","month":2,"day":3,"year":94,"recurring":true}]}`,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name: "error - duplicate id",
			body: `{"dates":[{"id":1,"title":"x","month":2,"day":3,"year":null,"recurring":true},` +
				`{"id":1,"title":"y","month":4,"day":5,"year":null,"recurring":false}]}`,
			wantStatus: http.StatusBadRequest,
			wantCode:   "bad_request",
		},
		{
			name: "error - syncer fails",
			body: string(fixture),
			setup: func(cs *mocks.CalendarSyncer) {
				cs.EXPECT().Sync(mock.Anything, fixtureDates).Return(model.CalendarResponse{}, errBoom)
			},
			wantStatus: http.StatusBadGateway,
			wantCode:   "upstream_failed",
		},
		{
			name:       "error - no key",
			body:       string(fixture),
			noKey:      true,
			wantStatus: http.StatusUnauthorized,
			wantCode:   "unauthorized",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			cs := mocks.NewCalendarSyncer(t)
			if tc.setup != nil {
				tc.setup(cs)
			}
			deps := server.Deps{Calendar: cs}
			if tc.noCalendar {
				deps = server.Deps{}
			}
			req := jsonRequest(t, "/calendar", []byte(tc.body))
			req.Method = http.MethodPut
			if tc.noKey {
				req.Header.Del("Authorization")
			}

			// when
			rec := serve(deps, req)

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
