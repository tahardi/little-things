package server

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/tahardi/little-things/backend/internal/model"
)

func handleGifts(deps Deps, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxJSONBody)
		var req model.GiftsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "body is larger than 1 MB")
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", "body is not valid JSON")
			return
		}
		if strings.TrimSpace(req.Name) == "" {
			writeError(w, http.StatusBadRequest, "bad_request", "name is required")
			return
		}

		ideas, err := deps.Gifts.Generate(r.Context(), req)
		if err != nil {
			logger.Error("generating gift ideas", "err", err)
			writeError(w, http.StatusBadGateway, "upstream_failed", "generating gift ideas failed")
			return
		}
		writeJSON(w, http.StatusOK, ideas)
	}
}
