package server_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/tahardi/little-things/backend/internal/server"
)

func TestNewServer(t *testing.T) {
	t.Run("error - health without key is unauthorized", func(t *testing.T) {
		// given
		handler := server.NewServer("secret", server.Deps{}, slog.New(slog.DiscardHandler))
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()

		// when
		handler.ServeHTTP(rec, req)

		// then
		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})
}
