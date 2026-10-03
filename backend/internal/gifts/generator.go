package gifts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
)

const ideaCount = 5

var ErrWrongIdeaCount = errors.New("wrong number of gift ideas")

type Generator struct {
	client llm.Client
}

func NewGenerator(client llm.Client) *Generator {
	return &Generator{client: client}
}

func (g *Generator) Generate(ctx context.Context, req model.GiftsRequest) (model.GiftsResponse, error) {
	encoded, err := json.Marshal(req)
	if err != nil {
		return model.GiftsResponse{}, fmt.Errorf("encoding person: %w", err)
	}
	var reply model.GiftsResponse
	if err := g.client.Structured(ctx, systemPrompt, "Person:\n"+string(encoded), schema, &reply); err != nil {
		return model.GiftsResponse{}, fmt.Errorf("generating gift ideas: %w", err)
	}

	ideas := make([]model.GiftIdea, 0, ideaCount)
	for _, idea := range reply.Ideas {
		text := strings.TrimSpace(idea.Text)
		if text == "" {
			continue
		}
		ideas = append(ideas, model.GiftIdea{Text: text, Why: strings.TrimSpace(idea.Why)})
	}
	if len(ideas) != ideaCount {
		return model.GiftsResponse{}, fmt.Errorf("checking gift ideas: got %d: %w", len(ideas), ErrWrongIdeaCount)
	}
	return model.GiftsResponse{Ideas: ideas}, nil
}
