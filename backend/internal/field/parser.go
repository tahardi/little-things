package field

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/tahardi/little-things/backend/internal/dates"
	"github.com/tahardi/little-things/backend/internal/llm"
	"github.com/tahardi/little-things/backend/internal/model"
)

var (
	ErrUnknownField   = errors.New("unknown field")
	ErrUnreadableDate = errors.New("could not read a date")
)

type Parser struct {
	client llm.Client
}

func NewParser(client llm.Client) *Parser {
	return &Parser{client: client}
}

func (p *Parser) Parse(ctx context.Context, field model.Field, transcript string) (json.RawMessage, error) {
	instruction, ok := instructions[field]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrUnknownField, field)
	}
	user := instruction + "\n\nAnswer:\n" + transcript
	switch field {
	case model.FieldBirthday:
		return p.parseBirthday(ctx, user)
	case model.FieldNicknames, model.FieldInterests:
		return p.parseList(ctx, field, user)
	case model.FieldName, model.FieldPreferredName, model.FieldRelationship, model.FieldAddress, model.FieldPhone:
		return p.parseString(ctx, field, user)
	default:
		return nil, fmt.Errorf("%w: %q", ErrUnknownField, field)
	}
}

func (p *Parser) parseString(ctx context.Context, field model.Field, user string) (json.RawMessage, error) {
	var out struct {
		Value string `json:"value"`
	}
	if err := p.client.Structured(ctx, systemPrompt, user, stringSchema, &out); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", field, err)
	}
	return json.Marshal(strings.TrimSpace(out.Value))
}

func (p *Parser) parseList(ctx context.Context, field model.Field, user string) (json.RawMessage, error) {
	var out struct {
		Value []string `json:"value"`
	}
	if err := p.client.Structured(ctx, systemPrompt, user, listSchema, &out); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", field, err)
	}
	seen := map[string]bool{}
	items := []string{}
	for _, v := range out.Value {
		v = strings.TrimSpace(v)
		key := strings.ToLower(v)
		if v == "" || seen[key] {
			continue
		}
		seen[key] = true
		items = append(items, v)
	}
	return json.Marshal(items)
}

func (p *Parser) parseBirthday(ctx context.Context, user string) (json.RawMessage, error) {
	var out struct {
		Value struct {
			Month *int `json:"month"`
			Day   *int `json:"day"`
			Year  *int `json:"year"`
		} `json:"value"`
	}
	if err := p.client.Structured(ctx, systemPrompt, user, birthdaySchema, &out); err != nil {
		return nil, fmt.Errorf("parsing birthday: %w", err)
	}
	v := out.Value
	if v.Month == nil || v.Day == nil || !dates.Valid(*v.Month, *v.Day) {
		return nil, ErrUnreadableDate
	}
	if v.Year != nil && (*v.Year < 1000 || *v.Year > 9999) {
		return nil, ErrUnreadableDate
	}
	return json.Marshal(model.Birthday{Month: *v.Month, Day: *v.Day, Year: v.Year})
}
