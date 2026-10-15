package server

import (
	"context"

	"github.com/tahardi/little-things/backend/internal/model"
)

type CalendarSyncer interface {
	Sync(ctx context.Context, dates []model.CalendarDate) (model.CalendarResponse, error)
}
