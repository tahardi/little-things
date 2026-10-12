package server

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/tahardi/little-things/backend/internal/transcribe"
)

const (
	maxUpload   = 50 << 20
	maxJSONBody = 1 << 20
)

func parseUpload(w http.ResponseWriter, r *http.Request) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxUpload)
	file, _, err := r.FormFile("audio")
	if err == nil {
		_ = file.Close()
	}
	if err != nil && !errors.Is(err, http.ErrMissingFile) {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "upload is larger than 50 MB")
			return false
		}
		writeError(w, http.StatusBadRequest, "bad_request", "request is not a valid multipart form")
		return false
	}
	return true
}

func transcribeUpload(
	w http.ResponseWriter,
	r *http.Request,
	transcriber transcribe.Transcriber,
	logger *slog.Logger,
) (string, bool) {
	file, _, err := r.FormFile("audio")
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "missing audio")
		return "", false
	}
	defer file.Close()

	path, err := saveTemp(file)
	if err != nil {
		logger.Error("saving audio", "err", err)
		writeError(w, http.StatusBadGateway, "upstream_failed", "saving audio failed")
		return "", false
	}
	defer os.Remove(path)

	transcript, err := transcriber.Transcribe(r.Context(), path)
	if err != nil {
		logger.Error("transcribing audio", "err", err)
		writeError(w, http.StatusBadGateway, "upstream_failed", "transcribing audio failed")
		return "", false
	}
	transcript = strings.TrimSpace(transcript)
	if transcript == "" {
		writeError(w, http.StatusUnprocessableEntity, "no_speech", "no speech found")
		return "", false
	}
	return transcript, true
}

func saveTemp(src io.Reader) (string, error) {
	tmp, err := os.CreateTemp("", "upload-*.m4a")
	if err != nil {
		return "", fmt.Errorf("creating temp file: %w", err)
	}
	defer tmp.Close()
	if _, err := io.Copy(tmp, src); err != nil {
		os.Remove(tmp.Name())
		return "", fmt.Errorf("writing temp file: %w", err)
	}
	return tmp.Name(), nil
}
