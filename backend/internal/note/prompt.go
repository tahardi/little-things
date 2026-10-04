package note

import (
	"encoding/json"
	"fmt"

	"github.com/tahardi/little-things/backend/internal/model"
)

const systemPrompt = `You turn a spoken note about people in the speaker's life into proposed updates to their records.
You receive a list of known people and a transcript. Each known person has an id, name, preferred_name, nicknames,
and relationship to the speaker.

Matching:
- Match a mention to a known person when it refers to their name, preferred name, a nickname, or their relationship
  to the speaker ("my sister-in-law"). Ignore case, extra spaces, hyphens, and possessives ("Mags's" matches the
  nickname "mags"; "sister in law" matches "sister-in-law").
- Use only ids from the list. Never invent an id.
- When a mentioned person matches nobody, or could match more than one known person, put them in unknown with the
  name as spoken and the part of the transcript about them. Do not guess.

Output:
- One entry in matches per known person mentioned. note is one or two plain sentences, in the third person, restating
  what the speaker said about that person only.
- changes lists structured updates for that person. Propose only what the speaker clearly stated:
  add_interest: something they enjoy or are into (text).
  add_gift_idea: a possible future gift for them (text).
  add_gift_given: a gift the speaker gave them (text; given_on as YYYY-MM-DD only if a full date was said; occasion if said).
  set_birthday: their birthday (month, day; year only if said).
  add_date: another date worth remembering (label, month, day, year only if said; recurring true for yearly dates
  such as anniversaries, false for one-time events).
  set_address, set_phone, set_relationship, set_preferred_name, add_nickname: the new value (text).
- Every change object has every field. Set fields that do not apply to its type to null.
- Write numbers as digits. Months are 1-12. Write phone numbers as digits.
- notes explains any uncertain match or anything left out, in one short sentence; otherwise an empty string.`

func nullable(t string) map[string]any {
	return map[string]any{"type": []string{t, "null"}}
}

func object(required []string, properties map[string]any) map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             required,
		"properties":           properties,
	}
}

var changeSchema = object(
	[]string{"type", "text", "label", "month", "day", "year", "recurring", "given_on", "occasion"},
	map[string]any{
		"type":      map[string]any{"type": "string", "enum": changeTypes()},
		"text":      nullable("string"),
		"label":     nullable("string"),
		"month":     nullable("integer"),
		"day":       nullable("integer"),
		"year":      nullable("integer"),
		"recurring": nullable("boolean"),
		"given_on":  nullable("string"),
		"occasion":  nullable("string"),
	},
)

var schema = object(
	[]string{"matches", "unknown", "notes"},
	map[string]any{
		"matches": map[string]any{
			"type": "array",
			"items": object(
				[]string{"person_id", "note", "changes"},
				map[string]any{
					"person_id": map[string]any{"type": "integer"},
					"note":      map[string]any{"type": "string"},
					"changes":   map[string]any{"type": "array", "items": changeSchema},
				},
			),
		},
		"unknown": map[string]any{
			"type": "array",
			"items": object(
				[]string{"name", "text"},
				map[string]any{
					"name": map[string]any{"type": "string"},
					"text": map[string]any{"type": "string"},
				},
			),
		},
		"notes": map[string]any{"type": "string"},
	},
)

func userMessage(transcript string, people []model.Person) (string, error) {
	if people == nil {
		people = []model.Person{}
	}
	encoded, err := json.Marshal(people)
	if err != nil {
		return "", fmt.Errorf("encoding people: %w", err)
	}
	return "People:\n" + string(encoded) + "\n\nTranscript:\n" + transcript, nil
}
