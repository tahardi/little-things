package gcal

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type recordedCall struct {
	method string
	path   string
	query  string
	body   string
}

func newGoogleEvents(t *testing.T, handler http.HandlerFunc) googleEvents {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	service, err := calendar.NewService(
		t.Context(),
		option.WithEndpoint(srv.URL),
		option.WithHTTPClient(srv.Client()),
	)
	require.NoError(t, err)
	return googleEvents{service: service, calendarID: "cal@group.calendar.google.com"}
}

func writeEvents(t *testing.T, w http.ResponseWriter, page calendar.Events) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	require.NoError(t, json.NewEncoder(w).Encode(page))
}

func taggedEvent(id string, tag string) *calendar.Event {
	e := &calendar.Event{Id: id}
	if tag != "" {
		e.ExtendedProperties = &calendar.EventExtendedProperties{Private: map[string]string{tagKey: tag}}
	}
	return e
}

func TestGoogleEvents_List(t *testing.T) {
	t.Run("happy path - keeps tagged events across pages", func(t *testing.T) {
		// given
		var calls []recordedCall
		events := newGoogleEvents(t, func(w http.ResponseWriter, r *http.Request) {
			calls = append(calls, recordedCall{method: r.Method, path: r.URL.Path, query: r.URL.RawQuery})
			if r.URL.Query().Get("pageToken") == "" {
				writeEvents(t, w, calendar.Events{
					Items:         []*calendar.Event{taggedEvent("e1", "11"), taggedEvent("e2", "")},
					NextPageToken: "page2",
				})
				return
			}
			writeEvents(t, w, calendar.Events{Items: []*calendar.Event{taggedEvent("e3", "12")}})
		})

		// when
		got, err := events.list(context.Background())

		// then
		require.NoError(t, err)
		require.Len(t, got, 2)
		assert.Equal(t, "e1", got[0].Id)
		assert.Equal(t, "e3", got[1].Id)
		require.Len(t, calls, 2)
		assert.Equal(t, http.MethodGet, calls[0].method)
		assert.Equal(t, "/calendars/cal@group.calendar.google.com/events", calls[0].path)
	})

	t.Run("error - google fails", func(t *testing.T) {
		// given
		events := newGoogleEvents(t, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		})

		// when
		_, err := events.list(context.Background())

		// then
		require.Error(t, err)
		assert.Contains(t, err.Error(), "listing events")
	})
}

func TestGoogleEvents_Mutations(t *testing.T) {
	event := &calendar.Event{Summary: "Sam's birthday"}
	tests := []struct {
		name       string
		call       func(events googleEvents) error
		wantMethod string
		wantPath   string
		wantBody   bool
		wantErr    string
	}{
		{
			name:       "insert",
			call:       func(e googleEvents) error { return e.insert(context.Background(), event) },
			wantMethod: http.MethodPost,
			wantPath:   "/calendars/cal@group.calendar.google.com/events",
			wantBody:   true,
			wantErr:    "inserting event",
		},
		{
			name:       "update",
			call:       func(e googleEvents) error { return e.update(context.Background(), "e1", event) },
			wantMethod: http.MethodPut,
			wantPath:   "/calendars/cal@group.calendar.google.com/events/e1",
			wantBody:   true,
			wantErr:    "updating event e1",
		},
		{
			name:       "delete",
			call:       func(e googleEvents) error { return e.delete(context.Background(), "e1") },
			wantMethod: http.MethodDelete,
			wantPath:   "/calendars/cal@group.calendar.google.com/events/e1",
			wantErr:    "deleting event e1",
		},
	}
	for _, tc := range tests {
		t.Run("happy path - "+tc.name, func(t *testing.T) {
			// given
			var got recordedCall
			events := newGoogleEvents(t, func(w http.ResponseWriter, r *http.Request) {
				body, err := io.ReadAll(r.Body)
				assert.NoError(t, err)
				got = recordedCall{method: r.Method, path: r.URL.Path, body: string(body)}
				writeEvents(t, w, calendar.Events{})
			})

			// when
			err := tc.call(events)

			// then
			require.NoError(t, err)
			assert.Equal(t, tc.wantMethod, got.method)
			assert.Equal(t, tc.wantPath, got.path)
			if tc.wantBody {
				assert.Contains(t, got.body, "Sam's birthday")
			}
		})

		t.Run("error - "+tc.name+" fails", func(t *testing.T) {
			// given
			events := newGoogleEvents(t, func(w http.ResponseWriter, _ *http.Request) {
				http.Error(w, "boom", http.StatusInternalServerError)
			})

			// when
			err := tc.call(events)

			// then
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.wantErr)
		})
	}
}
