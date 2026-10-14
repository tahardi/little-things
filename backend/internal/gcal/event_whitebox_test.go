package gcal

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/api/calendar/v3"

	"github.com/tahardi/little-things/backend/internal/model"
)

func want(id string, title string, start string, end string, recurrence ...string) *calendar.Event {
	return &calendar.Event{
		Summary:            title,
		Start:              &calendar.EventDateTime{Date: start},
		End:                &calendar.EventDateTime{Date: end},
		Recurrence:         recurrence,
		ExtendedProperties: &calendar.EventExtendedProperties{Private: map[string]string{tagKey: id}},
		Reminders:          &calendar.EventReminders{UseDefault: false, ForceSendFields: []string{"UseDefault"}},
	}
}

func TestEventFor(t *testing.T) {
	tests := []struct {
		name        string
		date        model.CalendarDate
		currentYear int
		want        *calendar.Event
	}{
		{
			name: "recurring with year",
			date: model.CalendarDate{
				ID: 11, Title: "Maggie's birthday", Month: 10, Day: 11, Year: new(1994), Recurring: true,
			},
			currentYear: 2026,
			want:        want("11", "Maggie's birthday", "1994-10-11", "1994-10-12", "RRULE:FREQ=YEARLY"),
		},
		{
			name:        "recurring without year uses current year",
			date:        model.CalendarDate{ID: 12, Title: "Sam's birthday", Month: 3, Day: 3, Recurring: true},
			currentYear: 2026,
			want:        want("12", "Sam's birthday", "2026-03-03", "2026-03-04", "RRULE:FREQ=YEARLY"),
		},
		{
			name:        "one-time has no recurrence",
			date:        model.CalendarDate{ID: 13, Title: "Priya: surgery", Month: 11, Day: 20, Year: new(2026)},
			currentYear: 2026,
			want:        want("13", "Priya: surgery", "2026-11-20", "2026-11-21"),
		},
		{
			name: "end crosses year",
			date: model.CalendarDate{
				ID: 14, Title: "New year's eve party", Month: 12, Day: 31, Year: new(2026),
			},
			currentYear: 2026,
			want:        want("14", "New year's eve party", "2026-12-31", "2027-01-01"),
		},
		{
			name: "recurring feb 29 in leap year",
			date: model.CalendarDate{
				ID: 15, Title: "Leap birthday", Month: 2, Day: 29, Year: new(1996), Recurring: true,
			},
			currentYear: 2026,
			want: want("15", "Leap birthday", "1996-02-29", "1996-03-01",
				"RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"),
		},
		{
			name:        "recurring feb 29 without year in non-leap year starts feb 28",
			date:        model.CalendarDate{ID: 16, Title: "Leap birthday", Month: 2, Day: 29, Recurring: true},
			currentYear: 2027,
			want: want("16", "Leap birthday", "2027-02-28", "2027-03-01",
				"RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"),
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			date := tc.date

			// when
			got := eventFor(date, tc.currentYear)

			// then
			assert.Equal(t, tc.want, got)
		})
	}
}
