package server

import (
	"context"

	"github.com/tahardi/little-things/backend/internal/model"
)

type NoteExtractor interface {
	Extract(ctx context.Context, transcript string, people []model.Person) (model.NoteResult, error)
}
