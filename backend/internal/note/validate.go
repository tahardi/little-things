package note

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/tahardi/little-things/backend/internal/dates"
	"github.com/tahardi/little-things/backend/internal/model"
)

var required = map[model.ChangeType][]string{
	model.ChangeAddInterest:      {"text"},
	model.ChangeAddGiftIdea:      {"text"},
	model.ChangeAddGiftGiven:     {"text"},
	model.ChangeSetAddress:       {"text"},
	model.ChangeSetPhone:         {"text"},
	model.ChangeSetRelationship:  {"text"},
	model.ChangeSetPreferredName: {"text"},
	model.ChangeAddNickname:      {"text"},
	model.ChangeSetBirthday:      {"month", "day"},
	model.ChangeAddDate:          {"label", "month", "day", "recurring"},
}

func changeTypes() []string {
	types := make([]string, 0, len(required))
	for t := range required {
		types = append(types, string(t))
	}
	slices.Sort(types)
	return types
}

func Validate(result model.NoteResult, people []model.Person) model.NoteResult {
	known := make(map[int64]bool, len(people))
	for _, p := range people {
		known[p.ID] = true
	}

	var notes []string
	if s := strings.TrimSpace(result.Notes); s != "" {
		notes = append(notes, s)
	}

	out := model.NoteResult{Matches: []model.Match{}, Unknown: []model.Unknown{}}
	for _, u := range result.Unknown {
		out.Unknown = append(out.Unknown, model.Unknown{Name: strings.TrimSpace(u.Name), Text: strings.TrimSpace(u.Text)})
	}

	index := map[int64]int{}
	for _, m := range result.Matches {
		text := strings.TrimSpace(m.Note)
		if !known[m.PersonID] {
			out.Unknown = append(out.Unknown, model.Unknown{Name: fmt.Sprintf("person %d", m.PersonID), Text: text})
			notes = append(notes, fmt.Sprintf("person id %d not found", m.PersonID))
			continue
		}

		changes := []model.Change{}
		for _, c := range m.Changes {
			clean, keep, problems := checkChange(c, m.PersonID)
			notes = append(notes, problems...)
			if keep {
				changes = append(changes, clean)
			}
		}

		if i, ok := index[m.PersonID]; ok {
			out.Matches[i].Changes = append(out.Matches[i].Changes, changes...)
			out.Matches[i].Note = strings.TrimSpace(out.Matches[i].Note + " " + text)
			continue
		}
		if text == "" && len(changes) == 0 {
			continue
		}
		index[m.PersonID] = len(out.Matches)
		out.Matches = append(out.Matches, model.Match{PersonID: m.PersonID, Note: text, Changes: changes})
	}

	out.Notes = strings.Join(notes, "; ")
	return out
}

func checkChange(c model.Change, personID int64) (model.Change, bool, []string) {
	fields, ok := required[c.Type]
	if !ok {
		return c, false, []string{fmt.Sprintf("dropped %s for person %d: unknown change type", c.Type, personID)}
	}

	c.Text = trimmed(c.Text)
	c.Label = trimmed(c.Label)
	c.Occasion = trimmed(c.Occasion)
	c.GivenOn = trimmed(c.GivenOn)

	for _, f := range fields {
		if missing(c, f) {
			return c, false, []string{fmt.Sprintf("dropped %s for person %d: missing %s", c.Type, personID, f)}
		}
	}

	isDate := c.Type == model.ChangeSetBirthday || c.Type == model.ChangeAddDate
	if isDate && !dates.Valid(*c.Month, *c.Day) {
		return c, false, []string{
			fmt.Sprintf("dropped %s for person %d: invalid date %d/%d", c.Type, personID, *c.Month, *c.Day),
		}
	}

	var problems []string
	if c.Year != nil && (*c.Year < 1000 || *c.Year > 9999) {
		problems = append(problems, fmt.Sprintf("cleared year for person %d: %d", personID, *c.Year))
		c.Year = nil
	}
	if c.GivenOn != nil {
		if _, err := time.Parse(time.DateOnly, *c.GivenOn); err != nil {
			problems = append(problems, fmt.Sprintf("cleared given_on for person %d: %s", personID, *c.GivenOn))
			c.GivenOn = nil
		}
	}
	return c, true, problems
}

func trimmed(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func missing(c model.Change, field string) bool {
	switch field {
	case "text":
		return c.Text == nil
	case "label":
		return c.Label == nil
	case "month":
		return c.Month == nil
	case "day":
		return c.Day == nil
	case "recurring":
		return c.Recurring == nil
	}
	return true
}
