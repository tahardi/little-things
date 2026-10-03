package gifts

const systemPrompt = `You suggest gift ideas for one person in the speaker's life.
You receive what the speaker knows about them: name, preferred name, relationship, interests, gift ideas already
saved, gifts already given, recent notes, and an optional occasion.
Suggest exactly 5 specific gifts or experiences that can be bought or booked, grounded in their interests and notes.
Never suggest anything in gifts_given or gift_ideas, or a close variant of one.
text is the gift as a short phrase. why is one sentence linking it to something the speaker said about them.`

var schema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"ideas"},
	"properties": map[string]any{
		"ideas": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"text", "why"},
				"properties": map[string]any{
					"text": map[string]any{"type": "string"},
					"why":  map[string]any{"type": "string"},
				},
			},
		},
	},
}
