# https://clarkgrubb.com/makefile-style-guide
MAKEFLAGS += --warn-undefined-variables
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := pre-pr
.DELETE_ON_ERROR:
.SUFFIXES:

.PHONY: pre-pr
pre-pr: tidy mock lint fix test-unit test-integration

.PHONY: fix
fix:
	@go fix ./...

lint_modfile=modfiles/golangci-lint/go.mod
.PHONY: lint
lint: tidy
	@go tool -modfile=$(lint_modfile) golangci-lint run --config .golangci.yaml

.PHONY: lint-version
lint-version:
	@go tool -modfile=$(lint_modfile) golangci-lint --version

mockery_modfile=modfiles/mockery/go.mod
.PHONY: mock
mock: tidy
	@go tool -modfile=$(mockery_modfile) mockery --config=.mockery.yaml

.PHONY: mock-version
mock-version:
	@go tool -modfile=$(mockery_modfile) mockery version

.PHONY: tidy
tidy:
	@go mod tidy

.PHONY: test-unit
test-unit: tidy
	@go test -v -count=1 -race ./internal/...

.PHONY: test-integration
test-integration: tidy
	@go test -v -count=1 -race ./test/integration/...

.PHONY: test-live
test-live: tidy
	@go test -v -count=1 -race ./test/live/...
