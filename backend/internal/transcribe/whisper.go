package transcribe

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

var ErrRunning = errors.New("running transcription tool")

type Whisper struct {
	ffmpegBin  string
	whisperBin string
	modelPath  string
	tempDir    string
}

func NewWhisper(modelPath string) *Whisper {
	return &Whisper{
		ffmpegBin:  "ffmpeg",
		whisperBin: "whisper-cli",
		modelPath:  modelPath,
		tempDir:    os.TempDir(),
	}
}

func (w *Whisper) Transcribe(ctx context.Context, audioPath string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", fmt.Errorf("transcribing: %w", err)
	}
	f, err := os.CreateTemp(w.tempDir, "clip-*.wav")
	if err != nil {
		return "", fmt.Errorf("creating temp file: %w", err)
	}
	wav := f.Name()
	_ = f.Close()
	defer os.Remove(wav)

	_, err = run(ctx, w.ffmpegBin, "-y", "-i", audioPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav)
	if err != nil {
		return "", err
	}
	out, err := run(ctx, w.whisperBin, "-m", w.modelPath, "-f", wav, "-l", "en", "-nt", "-np")
	if err != nil {
		return "", err
	}
	return strings.Join(strings.Fields(out), " "), nil
}

func run(ctx context.Context, bin string, args ...string) (string, error) {
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", fmt.Errorf("running %s: %w", bin, ctxErr)
		}
		return "", fmt.Errorf("%w: %s: %w: %s", ErrRunning, bin, err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}
