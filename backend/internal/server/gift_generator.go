package server

import (
	"context"

	"github.com/tahardi/little-things/backend/internal/model"
)

type GiftGenerator interface {
	Generate(ctx context.Context, req model.GiftsRequest) (model.GiftsResponse, error)
}
