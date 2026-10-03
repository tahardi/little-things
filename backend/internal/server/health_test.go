package server_test

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/server"
)

func TestServer_Health(t *testing.T) {
	want, err := os.ReadFile("../../../api/testdata/health-response.json")
	require.NoError(t, err)

	tests := []struct {
		name       string
		method     string
		wantStatus int
		wantBody   string
	}{
		{name: "happy path - get", method: http.MethodGet, wantStatus: http.StatusOK, wantBody: string(want)},
		{name: "error - post not allowed", method: http.MethodPost, wantStatus: http.StatusMethodNotAllowed},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			var logs bytes.Buffer
			logger := slog.New(slog.NewTextHandler(&logs, nil))
			srv := httptest.NewServer(server.NewServer("secret", server.Deps{}, logger))
			defer srv.Close()
			req, err := http.NewRequestWithContext(t.Context(), tc.method, srv.URL+"/health", nil)
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer secret")

			// when
			resp, err := http.DefaultClient.Do(req)

			// then
			require.NoError(t, err)
			defer resp.Body.Close()
			assert.Equal(t, tc.wantStatus, resp.StatusCode)
			if tc.wantBody != "" {
				body, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				assert.JSONEq(t, tc.wantBody, string(body))
			}
			assert.Contains(t, logs.String(), "/health")
			assert.NotContains(t, logs.String(), "secret")
		})
	}
}
