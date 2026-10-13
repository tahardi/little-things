package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/tahardi/little-things/backend/internal/dates"
	"github.com/tahardi/little-things/backend/internal/model"
)

const (
	minYear = 1000
	maxYear = 9999
)

func handleCalendar(deps Deps, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if deps.Calendar == nil {
			writeError(w, http.StatusServiceUnavailable, "calendar_not_configured", "calendar is not configured")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxJSONBody)
		var req model.CalendarRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "body is larger than 1 MB")
				return
			}
			writeError(w, http.StatusBadRequest, "bad_request", "body is not valid JSON")
			return
		}
		if req.Dates == nil {
			writeError(w, http.StatusBadRequest, "bad_request", "dates is required")
			return
		}
		if msg := checkDates(req.Dates); msg != "" {
			writeError(w, http.StatusBadRequest, "bad_request", msg)
			return
		}

		resp, err := deps.Calendar.Sync(r.Context(), req.Dates)
		if err != nil {
			logger.Error("syncing calendar", "err", err)
			writeError(w, http.StatusBadGateway, "upstream_failed", "syncing calendar failed")
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func checkDates(list []model.CalendarDate) string {
	seen := map[int64]bool{}
	for _, d := range list {
		switch {
		case seen[d.ID]:
			return fmt.Sprintf("date %d appears more than once", d.ID)
		case strings.TrimSpace(d.Title) == "":
			return fmt.Sprintf("date %d has no title", d.ID)
		case !dates.Valid(d.Month, d.Day):
			return fmt.Sprintf("date %d has an invalid month or day", d.ID)
		case d.Year != nil && (*d.Year < minYear || *d.Year > maxYear):
			return fmt.Sprintf("date %d has an invalid year", d.ID)
		}
		seen[d.ID] = true
	}
	return ""
}
