package config

import (
	"errors"
	"strings"
)

var ErrMissingKey = errors.New("LITTLETHINGS_KEY is required")

type Config struct {
	AnthropicAPIKey string
	AppKey          string
	WhisperBin      string
	WhisperModel    string
	FFmpegBin       string
	ListenAddr      string
}

func Load(getenv func(string) string) (Config, error) {
	key := getenv("LITTLETHINGS_KEY")
	if strings.TrimSpace(key) == "" {
		return Config{}, ErrMissingKey
	}
	return Config{
		AnthropicAPIKey: getenv("ANTHROPIC_API_KEY"),
		AppKey:          key,
		WhisperBin:      withDefault(getenv("WHISPER_BIN"), "whisper-cli"),
		WhisperModel:    getenv("WHISPER_MODEL"),
		FFmpegBin:       withDefault(getenv("FFMPEG_BIN"), "ffmpeg"),
		ListenAddr:      withDefault(getenv("LISTEN_ADDR"), "127.0.0.1:8081"),
	}, nil
}

func withDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
