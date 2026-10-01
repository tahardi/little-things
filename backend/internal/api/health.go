package api

import (
	"net/http"

	"github.com/tahardi/little-things/backend/internal/model"
)

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, model.HealthResponse{Status: "ok"})
}
