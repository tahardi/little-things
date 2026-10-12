package config

import (
	"errors"
	"strings"
)

var (
	ErrMissingKey          = errors.New("LITTLETHINGS_KEY is required")
	ErrMissingAnthropicKey = errors.New("ANTHROPIC_API_KEY is required")
	ErrMissingWhisperModel = errors.New("WHISPER_MODEL is required")
)

type Config struct {
	ListenAddr      string
	Key             string
	AnthropicAPIKey string
	WhisperBin      string
	WhisperModel    string
	FFmpegBin       string
}

func Load(getenv func(string) string) (Config, error) {
	key := getenv("LITTLETHINGS_KEY")
	if strings.TrimSpace(key) == "" {
		return Config{}, ErrMissingKey
	}
	anthropicKey := getenv("ANTHROPIC_API_KEY")
	if strings.TrimSpace(anthropicKey) == "" {
		return Config{}, ErrMissingAnthropicKey
	}
	whisperModel := getenv("WHISPER_MODEL")
	if strings.TrimSpace(whisperModel) == "" {
		return Config{}, ErrMissingWhisperModel
	}
	return Config{
		ListenAddr:      withDefault(getenv("LISTEN_ADDR"), "127.0.0.1:8081"),
		Key:             key,
		AnthropicAPIKey: anthropicKey,
		WhisperBin:      withDefault(getenv("WHISPER_BIN"), "whisper-cli"),
		WhisperModel:    whisperModel,
		FFmpegBin:       withDefault(getenv("FFMPEG_BIN"), "ffmpeg"),
	}, nil
}

func withDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
