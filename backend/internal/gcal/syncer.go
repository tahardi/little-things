package gcal

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"

	"github.com/tahardi/little-things/backend/internal/model"
)

type Syncer struct {
	events events
	now    func() time.Time
}

func NewSyncer(ctx context.Context, credentialsFile string, calendarID string) (*Syncer, error) {
	service, err := calendar.NewService(
		ctx,
		option.WithAuthCredentialsFile(option.ServiceAccount, credentialsFile),
		option.WithScopes(calendar.CalendarEventsScope),
	)
	if err != nil {
		return nil, fmt.Errorf("creating calendar service: %w", err)
	}
	return &Syncer{events: googleEvents{service: service, calendarID: calendarID}, now: time.Now}, nil
}

func (s *Syncer) Sync(ctx context.Context, dates []model.CalendarDate) (model.CalendarResponse, error) {
	existing, err := s.events.list(ctx)
	if err != nil {
		return model.CalendarResponse{}, fmt.Errorf("syncing calendar: %w", err)
	}
	p := reconcile(dates, existing, s.now().Year())

	var resp model.CalendarResponse
	for _, id := range p.deletes {
		if err := s.events.delete(ctx, id); err != nil {
			return resp, fmt.Errorf("syncing calendar: %w", err)
		}
		resp.Deleted++
	}
	for _, u := range p.updates {
		if err := s.events.update(ctx, u.id, u.event); err != nil {
			return resp, fmt.Errorf("syncing calendar: %w", err)
		}
		resp.Updated++
	}
	for _, e := range p.creates {
		if err := s.events.insert(ctx, e); err != nil {
			return resp, fmt.Errorf("syncing calendar: %w", err)
		}
		resp.Created++
	}
	return resp, nil
}
