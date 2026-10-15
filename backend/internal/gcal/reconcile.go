package gcal

import (
	"strconv"

	"google.golang.org/api/calendar/v3"

	"github.com/tahardi/little-things/backend/internal/model"
)

type update struct {
	id    string
	event *calendar.Event
}

type plan struct {
	creates []*calendar.Event
	updates []update
	deletes []string
}

func reconcile(desired []model.CalendarDate, existing []*calendar.Event, currentYear int) plan {
	byTag := map[string]*calendar.Event{}
	var p plan
	for _, e := range existing {
		tag := tagOf(e)
		if _, seen := byTag[tag]; seen {
			p.deletes = append(p.deletes, e.Id)
			continue
		}
		byTag[tag] = e
	}

	wanted := map[string]bool{}
	for _, d := range desired {
		tag := strconv.FormatInt(d.ID, 10)
		wanted[tag] = true
		event := eventFor(d, currentYear)
		current, ok := byTag[tag]
		switch {
		case !ok:
			p.creates = append(p.creates, event)
		case !sameEvent(current, event):
			p.updates = append(p.updates, update{id: current.Id, event: event})
		}
	}

	var stale []string
	for _, e := range existing {
		if byTag[tagOf(e)] == e && !wanted[tagOf(e)] {
			stale = append(stale, e.Id)
		}
	}
	p.deletes = append(stale, p.deletes...)
	return p
}
