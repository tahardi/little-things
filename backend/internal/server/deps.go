package server

import "github.com/tahardi/little-things/backend/internal/transcribe"

type Deps struct {
	Transcriber transcribe.Transcriber
	Fields      FieldParser
	Notes       NoteExtractor
	Gifts       GiftGenerator
}
