package server

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/tahardi/little-things/backend/internal/field"
	"github.com/tahardi/little-things/backend/internal/model"
)

func handleField(deps Deps, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !parseUpload(w, r) {
			return
		}
		defer func() { _ = r.MultipartForm.RemoveAll() }()

		f := model.Field(r.FormValue("field"))
		if !f.Valid() {
			writeError(w, http.StatusBadRequest, "bad_request",
				"field must be one of name, preferred_name, nicknames, relationship, birthday, address, phone, interests")
			return
		}

		transcript, ok := transcribeUpload(w, r, deps.Transcriber, logger)
		if !ok {
			return
		}

		value, err := deps.Fields.Parse(r.Context(), f, transcript)
		if errors.Is(err, field.ErrUnreadableDate) {
			writeError(w, http.StatusUnprocessableEntity, "unreadable_date", "could not read a date")
			return
		}
		if err != nil {
			logger.Error("parsing field", "field", f, "err", err)
			writeError(w, http.StatusBadGateway, "upstream_failed", "parsing field failed")
			return
		}
		writeJSON(w, http.StatusOK, model.FieldResponse{Transcript: transcript, Value: value})
	}
}
