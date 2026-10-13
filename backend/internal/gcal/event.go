package gcal

import (
	"slices"
	"strconv"
	"time"

	"google.golang.org/api/calendar/v3"

	"github.com/tahardi/little-things/backend/internal/model"
)

const (
	tagKey     = "littlethings_date_id"
	yearly     = "RRULE:FREQ=YEARLY"
	lastOfFeb  = "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"
	dateLayout = time.DateOnly
)

func eventFor(d model.CalendarDate, currentYear int) *calendar.Event {
	y := currentYear
	if d.Year != nil {
		y = *d.Year
	}
	lastDay := time.Date(y, time.Month(d.Month)+1, 0, 0, 0, 0, 0, time.UTC).Day()
	start := time.Date(y, time.Month(d.Month), min(d.Day, lastDay), 0, 0, 0, 0, time.UTC)

	var recurrence []string
	if d.Recurring {
		recurrence = []string{yearly}
		if time.Month(d.Month) == time.February && d.Day == 29 {
			recurrence = []string{lastOfFeb}
		}
	}

	return &calendar.Event{
		Summary:    d.Title,
		Start:      &calendar.EventDateTime{Date: start.Format(dateLayout)},
		End:        &calendar.EventDateTime{Date: start.AddDate(0, 0, 1).Format(dateLayout)},
		Recurrence: recurrence,
		ExtendedProperties: &calendar.EventExtendedProperties{
			Private: map[string]string{tagKey: strconv.FormatInt(d.ID, 10)},
		},
		Reminders: &calendar.EventReminders{UseDefault: false, ForceSendFields: []string{"UseDefault"}},
	}
}

func sameEvent(a *calendar.Event, b *calendar.Event) bool {
	return a.Summary == b.Summary &&
		dateOf(a.Start) == dateOf(b.Start) &&
		dateOf(a.End) == dateOf(b.End) &&
		slices.Equal(a.Recurrence, b.Recurrence)
}

func dateOf(d *calendar.EventDateTime) string {
	if d == nil {
		return ""
	}
	return d.Date
}

func tagOf(e *calendar.Event) string {
	if e.ExtendedProperties == nil {
		return ""
	}
	return e.ExtendedProperties.Private[tagKey]
}
