package api

import (
	"context"
	"encoding/json"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/transcribe"
)

type FieldParser interface {
	Parse(ctx context.Context, field model.Field, transcript string) (json.RawMessage, error)
}

type NoteExtractor interface {
	Extract(ctx context.Context, transcript string, people []model.Person) (model.NoteResult, error)
}

type GiftGenerator interface {
	Generate(ctx context.Context, req model.GiftsRequest) (model.GiftsResponse, error)
}

type Deps struct {
	Transcriber transcribe.Transcriber
	Fields      FieldParser
	Notes       NoteExtractor
	Gifts       GiftGenerator
}
