package gcal

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/api/calendar/v3"

	"github.com/tahardi/little-things/backend/internal/model"
)

func existing(id string, date model.CalendarDate) *calendar.Event {
	e := eventFor(date, 2026)
	e.Id = id
	return e
}

func TestReconcile(t *testing.T) {
	sam := model.CalendarDate{ID: 12, Title: "Sam's birthday", Month: 3, Day: 3, Recurring: true}
	samRenamed := sam
	samRenamed.Title = "Sammy's birthday"
	samMoved := sam
	samMoved.Day = 4
	samOnce := sam
	samOnce.Recurring = false
	maggie := model.CalendarDate{
		ID: 11, Title: "Maggie's birthday", Month: 10, Day: 11, Year: new(1994), Recurring: true,
	}

	tests := []struct {
		name     string
		desired  []model.CalendarDate
		existing []*calendar.Event
		want     plan
	}{
		{
			name:    "create missing",
			desired: []model.CalendarDate{sam},
			want:    plan{creates: []*calendar.Event{eventFor(sam, 2026)}},
		},
		{
			name:     "no-op when matching",
			desired:  []model.CalendarDate{sam},
			existing: []*calendar.Event{existing("e1", sam)},
			want:     plan{},
		},
		{
			name:     "title change updates",
			desired:  []model.CalendarDate{samRenamed},
			existing: []*calendar.Event{existing("e1", sam)},
			want:     plan{updates: []update{{id: "e1", event: eventFor(samRenamed, 2026)}}},
		},
		{
			name:     "date change updates",
			desired:  []model.CalendarDate{samMoved},
			existing: []*calendar.Event{existing("e1", sam)},
			want:     plan{updates: []update{{id: "e1", event: eventFor(samMoved, 2026)}}},
		},
		{
			name:     "recurring toggle updates",
			desired:  []model.CalendarDate{samOnce},
			existing: []*calendar.Event{existing("e1", sam)},
			want:     plan{updates: []update{{id: "e1", event: eventFor(samOnce, 2026)}}},
		},
		{
			name:     "delete missing from desired",
			desired:  []model.CalendarDate{maggie},
			existing: []*calendar.Event{existing("e1", sam), existing("e2", maggie)},
			want:     plan{deletes: []string{"e1"}},
		},
		{
			name:     "duplicate tag deletes extras",
			desired:  []model.CalendarDate{sam},
			existing: []*calendar.Event{existing("e1", sam), existing("e2", sam), existing("e3", samRenamed)},
			want:     plan{deletes: []string{"e2", "e3"}},
		},
		{
			name:     "empty desired deletes all",
			existing: []*calendar.Event{existing("e1", sam), existing("e2", maggie)},
			want:     plan{deletes: []string{"e1", "e2"}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			desired := tc.desired

			// when
			got := reconcile(desired, tc.existing, 2026)

			// then
			assert.Equal(t, tc.want, got)
		})
	}
}
