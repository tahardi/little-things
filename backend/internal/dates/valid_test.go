package dates_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/tahardi/little-things/backend/internal/dates"
)

func TestValid(t *testing.T) {
	tests := []struct {
		name  string
		month int
		day   int
		want  bool
	}{
		{name: "happy path - jan 31", month: 1, day: 31, want: true},
		{name: "happy path - feb 29", month: 2, day: 29, want: true},
		{name: "happy path - dec 31", month: 12, day: 31, want: true},
		{name: "error - feb 30", month: 2, day: 30, want: false},
		{name: "error - apr 31", month: 4, day: 31, want: false},
		{name: "error - month 13", month: 13, day: 1, want: false},
		{name: "error - month 0", month: 0, day: 1, want: false},
		{name: "error - day 0", month: 5, day: 0, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			month, day := tc.month, tc.day

			// when
			got := dates.Valid(month, day)

			// then
			assert.Equal(t, tc.want, got)
		})
	}
}
