package server_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/server"
)

const key = "secret"

func serve(deps server.Deps, req *http.Request) *httptest.ResponseRecorder {
	handler := server.NewServer(key, deps, slog.New(slog.DiscardHandler))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func multipartRequest(t *testing.T, path string, fields map[string]string, audio []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for name, value := range fields {
		require.NoError(t, writer.WriteField(name, value))
	}
	if audio != nil {
		part, err := writer.CreateFormFile("audio", "clip.m4a")
		require.NoError(t, err)
		_, err = part.Write(audio)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+key)
	return req
}

func jsonRequest(t *testing.T, path string, body []byte) *http.Request {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	return req
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var resp model.ErrorResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.Error.Code
}

func tooBig() []byte {
	return make([]byte, 51<<20)
}
