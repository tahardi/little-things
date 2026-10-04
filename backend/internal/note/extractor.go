package note

import (
	"context"
	"fmt"

	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
)

type Extractor struct {
	client llm.Client
}

func NewExtractor(client llm.Client) *Extractor {
	return &Extractor{client: client}
}

func (e *Extractor) Extract(ctx context.Context, transcript string, people []model.Person) (model.NoteResult, error) {
	user, err := userMessage(transcript, people)
	if err != nil {
		return model.NoteResult{}, err
	}
	var result model.NoteResult
	if err := e.client.Structured(ctx, systemPrompt, user, schema, &result); err != nil {
		return model.NoteResult{}, fmt.Errorf("extracting note: %w", err)
	}
	return Validate(result, people), nil
}
