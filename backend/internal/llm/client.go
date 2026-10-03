package llm

import (
	"context"
	"errors"
)

var (
	ErrRefused         = errors.New("model refused the request")
	ErrInvalidResponse = errors.New("parsing model response")
)

type Client interface {
	Structured(ctx context.Context, system string, user string, schema map[string]any, out any) error
}
