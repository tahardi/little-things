package model

import "encoding/json"

type Field string

const (
	FieldName          Field = "name"
	FieldPreferredName Field = "preferred_name"
	FieldNicknames     Field = "nicknames"
	FieldRelationship  Field = "relationship"
	FieldBirthday      Field = "birthday"
	FieldAddress       Field = "address"
	FieldPhone         Field = "phone"
	FieldInterests     Field = "interests"
)

func (f Field) Valid() bool {
	switch f {
	case FieldName,
		FieldPreferredName,
		FieldNicknames,
		FieldRelationship,
		FieldBirthday,
		FieldAddress,
		FieldPhone,
		FieldInterests:
		return true
	default:
		return false
	}
}

type Birthday struct {
	Month int  `json:"month"`
	Day   int  `json:"day"`
	Year  *int `json:"year"`
}

type FieldResponse struct {
	Transcript string          `json:"transcript"`
	Value      json.RawMessage `json:"value"`
}
