package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/tahardi/little-things/backend/internal/config"
	"github.com/tahardi/little-things/backend/internal/field"
	"github.com/tahardi/little-things/backend/internal/gifts"
	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/note"
	"github.com/tahardi/little-things/backend/internal/server"
	"github.com/tahardi/little-things/backend/internal/transcribe"
)

const (
	readHeaderTimeout = 10 * time.Second
	writeTimeout      = 3 * time.Minute
	shutdownTimeout   = 10 * time.Second
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if err := run(logger); err != nil {
		logger.Error("running server", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	client := llm.NewAnthropic(cfg.AnthropicAPIKey)
	deps := server.Deps{
		Transcriber: transcribe.NewWhisper(cfg.FFmpegBin, cfg.WhisperBin, cfg.WhisperModel, os.TempDir()),
		Fields:      field.NewParser(client),
		Notes:       note.NewExtractor(client),
		Gifts:       gifts.NewGenerator(client),
	}

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           server.NewServer(cfg.Key, deps, logger),
		ReadHeaderTimeout: readHeaderTimeout,
		WriteTimeout:      writeTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
	logger.Info("listening", "addr", cfg.ListenAddr)

	select {
	case err = <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}
