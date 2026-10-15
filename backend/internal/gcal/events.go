package gcal

import (
	"context"
	"fmt"

	"google.golang.org/api/calendar/v3"
)

const maxPageSize = 2500

type events interface {
	list(ctx context.Context) ([]*calendar.Event, error)
	insert(ctx context.Context, event *calendar.Event) error
	update(ctx context.Context, id string, event *calendar.Event) error
	delete(ctx context.Context, id string) error
}

type googleEvents struct {
	service    *calendar.Service
	calendarID string
}

func (g googleEvents) list(ctx context.Context) ([]*calendar.Event, error) {
	var tagged []*calendar.Event
	err := g.service.Events.List(g.calendarID).
		ShowDeleted(false).
		SingleEvents(false).
		MaxResults(maxPageSize).
		Pages(ctx, func(page *calendar.Events) error {
			for _, e := range page.Items {
				if tagOf(e) != "" {
					tagged = append(tagged, e)
				}
			}
			return nil
		})
	if err != nil {
		return nil, fmt.Errorf("listing events: %w", err)
	}
	return tagged, nil
}

func (g googleEvents) insert(ctx context.Context, event *calendar.Event) error {
	if _, err := g.service.Events.Insert(g.calendarID, event).Context(ctx).Do(); err != nil {
		return fmt.Errorf("inserting event: %w", err)
	}
	return nil
}

func (g googleEvents) update(ctx context.Context, id string, event *calendar.Event) error {
	if _, err := g.service.Events.Update(g.calendarID, id, event).Context(ctx).Do(); err != nil {
		return fmt.Errorf("updating event %s: %w", id, err)
	}
	return nil
}

func (g googleEvents) delete(ctx context.Context, id string) error {
	if err := g.service.Events.Delete(g.calendarID, id).Context(ctx).Do(); err != nil {
		return fmt.Errorf("deleting event %s: %w", id, err)
	}
	return nil
}
