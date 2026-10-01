package field

import "github.com/tahardi/little-things/backend/internal/model"

const systemPrompt = `You read one spoken answer to a question about a person and return the answer as structured data.
The answer was transcribed from speech. Fix obvious transcription artifacts: write numbers as digits,
write phone numbers as digits separated by dashes (for example 555-123-4567), and capitalize names and places.
Return only what the speaker said. Never invent details. If the speaker gave no answer, return an empty value.`

var instructions = map[model.Field]string{
	model.FieldName:          "The question was: What is their full name? Return the name as value.",
	model.FieldPreferredName: "The question was: What name do they go by? Return that name as value.",
	model.FieldNicknames: "The question was: What nicknames do they have? " +
		"Return each nickname as one item in value. Return an empty list if none were given.",
	model.FieldRelationship: "The question was: How do you know them? " +
		"Return a short lowercase relationship label as value, for example \"sister-in-law\" or \"college friend\".",
	model.FieldBirthday: "The question was: When is their birthday? " +
		"Return month as 1-12 and day as 1-31. Return year as four digits only when the speaker said a year; " +
		"otherwise null. If the speaker gave no date, return null for month and day.",
	model.FieldAddress: "The question was: What is their address? " +
		"Return the address on one line formatted like a mailing address, for example " +
		"\"12 Elm St, Springfield, IL 62701\".",
	model.FieldPhone: "The question was: What is their phone number? Return the number as value.",
	model.FieldInterests: "The question was: What are they interested in? " +
		"Return each interest as one short item in value, for example \"open water swimming\".",
}

var stringSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"value"},
	"properties":           map[string]any{"value": map[string]any{"type": "string"}},
}

var listSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"value"},
	"properties": map[string]any{
		"value": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
	},
}

var birthdaySchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"value"},
	"properties": map[string]any{
		"value": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []string{"month", "day", "year"},
			"properties": map[string]any{
				"month": map[string]any{"type": []string{"integer", "null"}},
				"day":   map[string]any{"type": []string{"integer", "null"}},
				"year":  map[string]any{"type": []string{"integer", "null"}},
			},
		},
	},
}
