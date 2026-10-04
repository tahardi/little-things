package note

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/tahardi/little-things/backend/internal/model"
)

func TestChangeTypes(t *testing.T) {
	// given
	want := []string{
		"add_date",
		"add_gift_given",
		"add_gift_idea",
		"add_interest",
		"add_nickname",
		"set_address",
		"set_birthday",
		"set_phone",
		"set_preferred_name",
		"set_relationship",
	}

	// when
	got := changeTypes()

	// then
	assert.Equal(t, want, got)
}

func TestTrimmed(t *testing.T) {
	tests := []struct {
		name  string
		input *string
		want  *string
	}{
		{"nil stays nil", nil, nil},
		{"empty becomes nil", new(""), nil},
		{"spaces become nil", new("   \t\n"), nil},
		{"trims both ends", new("  pottery "), new("pottery")},
		{"keeps inner spaces", new("fly  fishing"), new("fly  fishing")},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			input := tc.input

			// when
			got := trimmed(input)

			// then
			assert.Equal(t, tc.want, got)
		})
	}

	t.Run("happy path - does not change input", func(t *testing.T) {
		// given
		input := new("  pottery ")

		// when
		_ = trimmed(input)

		// then
		assert.Equal(t, "  pottery ", *input)
	})
}

func TestMissing(t *testing.T) {
	full := model.Change{
		Text:      new("x"),
		Label:     new("x"),
		Month:     new(1),
		Day:       new(1),
		Recurring: new(false),
	}

	tests := []struct {
		name   string
		change model.Change
		field  string
		want   bool
	}{
		{"text present", full, "text", false},
		{"text absent", model.Change{}, "text", true},
		{"label present", full, "label", false},
		{"label absent", model.Change{}, "label", true},
		{"month present", full, "month", false},
		{"month absent", model.Change{}, "month", true},
		{"day present", full, "day", false},
		{"day absent", model.Change{}, "day", true},
		{"recurring false counts as present", full, "recurring", false},
		{"recurring absent", model.Change{}, "recurring", true},
		{"unknown field is missing", full, "email", true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			change := tc.change

			// when
			got := missing(change, tc.field)

			// then
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestCheckChange(t *testing.T) {
	tests := []struct {
		name         string
		change       model.Change
		wantChange   model.Change
		wantKeep     bool
		wantProblems []string
	}{
		{
			name:       "keeps valid change and trims text",
			change:     model.Change{Type: model.ChangeAddInterest, Text: new("  pottery ")},
			wantChange: model.Change{Type: model.ChangeAddInterest, Text: new("pottery")},
			wantKeep:   true,
		},
		{
			name:         "drops unknown type",
			change:       model.Change{Type: "set_email", Text: new("a@b.c")},
			wantChange:   model.Change{Type: "set_email", Text: new("a@b.c")},
			wantProblems: []string{"dropped set_email for person 7: unknown change type"},
		},
		{
			name:         "drops blank text",
			change:       model.Change{Type: model.ChangeSetPhone, Text: new("  ")},
			wantChange:   model.Change{Type: model.ChangeSetPhone},
			wantProblems: []string{"dropped set_phone for person 7: missing text"},
		},
		{
			name:         "reports first missing field only",
			change:       model.Change{Type: model.ChangeAddDate},
			wantChange:   model.Change{Type: model.ChangeAddDate},
			wantProblems: []string{"dropped add_date for person 7: missing label"},
		},
		{
			name:         "drops birthday missing day",
			change:       model.Change{Type: model.ChangeSetBirthday, Month: new(3)},
			wantChange:   model.Change{Type: model.ChangeSetBirthday, Month: new(3)},
			wantProblems: []string{"dropped set_birthday for person 7: missing day"},
		},
		{
			name:         "drops add_date missing recurring",
			change:       model.Change{Type: model.ChangeAddDate, Label: new("Move"), Month: new(6), Day: new(1)},
			wantChange:   model.Change{Type: model.ChangeAddDate, Label: new("Move"), Month: new(6), Day: new(1)},
			wantProblems: []string{"dropped add_date for person 7: missing recurring"},
		},
		{
			name:         "drops invalid birthday",
			change:       model.Change{Type: model.ChangeSetBirthday, Month: new(4), Day: new(31)},
			wantChange:   model.Change{Type: model.ChangeSetBirthday, Month: new(4), Day: new(31)},
			wantProblems: []string{"dropped set_birthday for person 7: invalid date 4/31"},
		},
		{
			name: "drops invalid add_date",
			change: model.Change{
				Type:      model.ChangeAddDate,
				Label:     new("Anniversary"),
				Month:     new(13),
				Day:       new(1),
				Recurring: new(true),
			},
			wantChange: model.Change{
				Type:      model.ChangeAddDate,
				Label:     new("Anniversary"),
				Month:     new(13),
				Day:       new(1),
				Recurring: new(true),
			},
			wantProblems: []string{"dropped add_date for person 7: invalid date 13/1"},
		},
		{
			name:       "keeps feb 29",
			change:     model.Change{Type: model.ChangeSetBirthday, Month: new(2), Day: new(29)},
			wantChange: model.Change{Type: model.ChangeSetBirthday, Month: new(2), Day: new(29)},
			wantKeep:   true,
		},
		{
			name:       "does not date-check other types",
			change:     model.Change{Type: model.ChangeAddInterest, Text: new("x"), Month: new(2), Day: new(30)},
			wantChange: model.Change{Type: model.ChangeAddInterest, Text: new("x"), Month: new(2), Day: new(30)},
			wantKeep:   true,
		},
		{
			name:         "clears year below range",
			change:       model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2), Year: new(999)},
			wantChange:   model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2)},
			wantKeep:     true,
			wantProblems: []string{"cleared year for person 7: 999"},
		},
		{
			name:         "clears year above range",
			change:       model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2), Year: new(10000)},
			wantChange:   model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2)},
			wantKeep:     true,
			wantProblems: []string{"cleared year for person 7: 10000"},
		},
		{
			name:       "keeps year at lower bound",
			change:     model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2), Year: new(1000)},
			wantChange: model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2), Year: new(1000)},
			wantKeep:   true,
		},
		{
			name:       "keeps year at upper bound",
			change:     model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2), Year: new(9999)},
			wantChange: model.Change{Type: model.ChangeSetBirthday, Month: new(1), Day: new(2), Year: new(9999)},
			wantKeep:   true,
		},
		{
			name:       "keeps valid given_on",
			change:     model.Change{Type: model.ChangeAddGiftGiven, Text: new("book"), GivenOn: new(" 2025-12-25 ")},
			wantChange: model.Change{Type: model.ChangeAddGiftGiven, Text: new("book"), GivenOn: new("2025-12-25")},
			wantKeep:   true,
		},
		{
			name:         "clears impossible given_on",
			change:       model.Change{Type: model.ChangeAddGiftGiven, Text: new("book"), GivenOn: new("2025-02-30")},
			wantChange:   model.Change{Type: model.ChangeAddGiftGiven, Text: new("book")},
			wantKeep:     true,
			wantProblems: []string{"cleared given_on for person 7: 2025-02-30"},
		},
		{
			name:       "blank given_on and occasion become nil without a problem",
			change:     model.Change{Type: model.ChangeAddGiftGiven, Text: new("book"), GivenOn: new(" "), Occasion: new(" ")},
			wantChange: model.Change{Type: model.ChangeAddGiftGiven, Text: new("book")},
			wantKeep:   true,
		},
		{
			name: "reports year and given_on problems together",
			change: model.Change{
				Type:    model.ChangeAddGiftGiven,
				Text:    new("book"),
				Year:    new(94),
				GivenOn: new("last summer"),
			},
			wantChange: model.Change{Type: model.ChangeAddGiftGiven, Text: new("book")},
			wantKeep:   true,
			wantProblems: []string{
				"cleared year for person 7: 94",
				"cleared given_on for person 7: last summer",
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			change := tc.change

			// when
			gotChange, gotKeep, gotProblems := checkChange(change, 7)

			// then
			assert.Equal(t, tc.wantChange, gotChange)
			assert.Equal(t, tc.wantKeep, gotKeep)
			assert.Equal(t, tc.wantProblems, gotProblems)
		})
	}

	t.Run("happy path - does not change input", func(t *testing.T) {
		// given
		input := model.Change{Type: model.ChangeAddInterest, Text: new("  pottery ")}

		// when
		_, _, _ = checkChange(input, 7)

		// then
		assert.Equal(t, "  pottery ", *input.Text)
	})
}
