package server

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/tahardi/little-things/backend/internal/model"
)

func handleNote(deps Deps, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !parseUpload(w, r) {
			return
		}
		defer func() { _ = r.MultipartForm.RemoveAll() }()

		raw := r.FormValue("people")
		if raw == "" {
			writeError(w, http.StatusBadRequest, "bad_request", "missing people")
			return
		}
		people := []model.Person{}
		if err := json.Unmarshal([]byte(raw), &people); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "people is not valid JSON")
			return
		}

		transcript, ok := transcribeUpload(w, r, deps.Transcriber, logger)
		if !ok {
			return
		}

		result, err := deps.Notes.Extract(r.Context(), transcript, people)
		if err != nil {
			logger.Error("extracting note", "err", err)
			writeError(w, http.StatusBadGateway, "upstream_failed", "extracting note failed")
			return
		}
		writeJSON(w, http.StatusOK, model.NoteResponse{
			Transcript: transcript,
			Matches:    result.Matches,
			Unknown:    result.Unknown,
			Notes:      result.Notes,
		})
	}
}
