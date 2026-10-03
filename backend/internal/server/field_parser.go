package server

import (
	"context"
	"encoding/json"

	"github.com/tahardi/little-things/backend/internal/model"
)

type FieldParser interface {
	Parse(ctx context.Context, field model.Field, transcript string) (json.RawMessage, error)
}
