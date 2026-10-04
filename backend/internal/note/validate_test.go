package note_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/tahardi/little-things/backend/internal/model"
	"github.com/tahardi/little-things/backend/internal/note"
)

func change(t model.ChangeType) model.Change {
	return model.Change{Type: t}
}

func people() []model.Person {
	return []model.Person{
		{ID: 1, Name: "Margaret Lin", PreferredName: new("Maggie"), Nicknames: []string{"Mags"}, Relationship: new("sister-in-law")},
		{ID: 2, Name: "Sam Ortiz", Nicknames: []string{"Sammy"}, Relationship: new("college friend")},
	}
}

func TestValidate(t *testing.T) {
	interest := change(model.ChangeAddInterest)
	interest.Text = new("  pottery ")
	interestClean := change(model.ChangeAddInterest)
	interestClean.Text = new("pottery")

	blankInterest := change(model.ChangeAddInterest)
	blankInterest.Text = new("   ")

	feb30 := change(model.ChangeSetBirthday)
	feb30.Month, feb30.Day = new(2), new(30)

	feb29 := change(model.ChangeSetBirthday)
	feb29.Month, feb29.Day = new(2), new(29)

	noLabel := change(model.ChangeAddDate)
	noLabel.Month, noLabel.Day, noLabel.Recurring = new(6), new(14), new(true)

	badType := change(model.ChangeType("set_email"))
	badType.Text = new("mags@example.com")

	shortYear := change(model.ChangeSetBirthday)
	shortYear.Month, shortYear.Day, shortYear.Year = new(10), new(11), new(94)
	shortYearClean := change(model.ChangeSetBirthday)
	shortYearClean.Month, shortYearClean.Day = new(10), new(11)

	vagueGiven := change(model.ChangeAddGiftGiven)
	vagueGiven.Text, vagueGiven.GivenOn = new("concert tickets"), new("last summer")
	vagueGivenClean := change(model.ChangeAddGiftGiven)
	vagueGivenClean.Text = new("concert tickets")

	nickname := change(model.ChangeAddNickname)
	nickname.Text = new("Mags")

	tests := []struct {
		name  string
		input model.NoteResult
		want  model.NoteResult
	}{
		{
			name: "keeps valid change and trims text",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: " Getting into pottery. ", Changes: []model.Change{interest}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "Getting into pottery.", Changes: []model.Change{interestClean}}},
				Unknown: []model.Unknown{},
			},
		},
		{
			name: "moves unknown person id to unknown",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 99, Note: "Likes fly fishing.", Changes: []model.Change{interestClean}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{},
				Unknown: []model.Unknown{{Name: "person 99", Text: "Likes fly fishing."}},
				Notes:   "person id 99 not found",
			},
		},
		{
			name: "drops impossible date",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 2, Note: "Birthday is Feb 30.", Changes: []model.Change{feb30}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{{PersonID: 2, Note: "Birthday is Feb 30.", Changes: []model.Change{}}},
				Unknown: []model.Unknown{},
				Notes:   "dropped set_birthday for person 2: invalid date 2/30",
			},
		},
		{
			name: "keeps feb 29 without year",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 2, Note: "Leap day birthday.", Changes: []model.Change{feb29}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{{PersonID: 2, Note: "Leap day birthday.", Changes: []model.Change{feb29}}},
				Unknown: []model.Unknown{},
			},
		},
		{
			name: "drops change missing required field",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "Anniversary.", Changes: []model.Change{noLabel, blankInterest}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "Anniversary.", Changes: []model.Change{}}},
				Unknown: []model.Unknown{},
				Notes: "dropped add_date for person 1: missing label; " +
					"dropped add_interest for person 1: missing text",
			},
		},
		{
			name: "drops unknown change type",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "New email.", Changes: []model.Change{badType}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "New email.", Changes: []model.Change{}}},
				Unknown: []model.Unknown{},
				Notes:   "dropped set_email for person 1: unknown change type",
			},
		},
		{
			name: "clears bad year and bad given_on",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "Details.", Changes: []model.Change{shortYear, vagueGiven}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{
					{PersonID: 1, Note: "Details.", Changes: []model.Change{shortYearClean, vagueGivenClean}},
				},
				Unknown: []model.Unknown{},
				Notes:   "cleared year for person 1: 94; cleared given_on for person 1: last summer",
			},
		},
		{
			name: "merges matches for same person",
			input: model.NoteResult{
				Matches: []model.Match{
					{PersonID: 1, Note: "Into pottery.", Changes: []model.Change{interestClean}},
					{PersonID: 1, Note: "Goes by Mags.", Changes: []model.Change{nickname}},
				},
			},
			want: model.NoteResult{
				Matches: []model.Match{
					{PersonID: 1, Note: "Into pottery. Goes by Mags.", Changes: []model.Change{interestClean, nickname}},
				},
				Unknown: []model.Unknown{},
			},
		},
		{
			name: "removes empty match",
			input: model.NoteResult{
				Matches: []model.Match{{PersonID: 1, Note: "  ", Changes: []model.Change{blankInterest}}},
			},
			want: model.NoteResult{
				Matches: []model.Match{},
				Unknown: []model.Unknown{},
				Notes:   "dropped add_interest for person 1: missing text",
			},
		},
		{
			name: "trims unknown and keeps model notes first",
			input: model.NoteResult{
				Unknown: []model.Unknown{{Name: " Dave ", Text: " Likes fly fishing. "}},
				Matches: []model.Match{{PersonID: 99, Note: "Something."}},
				Notes:   " \"Sammy\" matched Sam Ortiz. ",
			},
			want: model.NoteResult{
				Matches: []model.Match{},
				Unknown: []model.Unknown{
					{Name: "Dave", Text: "Likes fly fishing."},
					{Name: "person 99", Text: "Something."},
				},
				Notes: "\"Sammy\" matched Sam Ortiz.; person id 99 not found",
			},
		},
		{
			name:  "nil slices become empty",
			input: model.NoteResult{},
			want:  model.NoteResult{Matches: []model.Match{}, Unknown: []model.Unknown{}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// given
			input := tc.input

			// when
			got := note.Validate(input, people())

			// then
			assert.Equal(t, tc.want, got)
		})
	}

	t.Run("happy path - does not mutate input", func(t *testing.T) {
		// given
		input := model.NoteResult{
			Matches: []model.Match{{PersonID: 1, Note: " x ", Changes: []model.Change{interest}}},
		}

		// when
		_ = note.Validate(input, people())

		// then
		assert.Equal(t, "  pottery ", *input.Matches[0].Changes[0].Text)
		assert.Equal(t, " x ", input.Matches[0].Note)
	})
}
