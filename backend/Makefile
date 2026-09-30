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

tools_dir=.tools
whisper_version ?= v1.9.4
whisper_cuda ?= 0
whisper_model_name ?= tiny.en
whisper_src=$(tools_dir)/whisper.cpp

.PHONY: whisper-build
whisper-build:
	@if [ ! -d $(whisper_src) ]; then \
		git clone --depth 1 --branch $(whisper_version) https://github.com/ggml-org/whisper.cpp $(whisper_src); \
	fi
	@cmake -S $(whisper_src) -B $(whisper_src)/build -DGGML_CUDA=$(whisper_cuda)
	@cmake --build $(whisper_src)/build -j --config Release

.PHONY: whisper-model
whisper-model:
	@mkdir -p $(tools_dir)/models
	@curl -fL -o $(tools_dir)/models/ggml-$(whisper_model_name).bin \
		https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$(whisper_model_name).bin

WHISPER_BIN ?= $(CURDIR)/$(whisper_src)/build/bin/whisper-cli
WHISPER_MODEL ?= $(CURDIR)/$(tools_dir)/models/ggml-$(whisper_model_name).bin

.PHONY: test-integration
test-integration: tidy
	@WHISPER_BIN=$(WHISPER_BIN) WHISPER_MODEL=$(WHISPER_MODEL) go test -v -count=1 -race ./test/integration/...

.PHONY: test-live
test-live: tidy
	@go test -v -count=1 -race ./test/live/...
