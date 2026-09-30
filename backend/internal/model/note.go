package model

type Person struct {
	ID            int64    `json:"id"`
	Name          string   `json:"name"`
	PreferredName *string  `json:"preferred_name"`
	Nicknames     []string `json:"nicknames"`
	Relationship  *string  `json:"relationship"`
}

type ChangeType string

const (
	ChangeAddInterest      ChangeType = "add_interest"
	ChangeAddGiftIdea      ChangeType = "add_gift_idea"
	ChangeAddGiftGiven     ChangeType = "add_gift_given"
	ChangeSetBirthday      ChangeType = "set_birthday"
	ChangeAddDate          ChangeType = "add_date"
	ChangeSetAddress       ChangeType = "set_address"
	ChangeSetPhone         ChangeType = "set_phone"
	ChangeSetRelationship  ChangeType = "set_relationship"
	ChangeSetPreferredName ChangeType = "set_preferred_name"
	ChangeAddNickname      ChangeType = "add_nickname"
)

type Change struct {
	Type      ChangeType `json:"type"`
	Text      *string    `json:"text"`
	Label     *string    `json:"label"`
	Month     *int       `json:"month"`
	Day       *int       `json:"day"`
	Year      *int       `json:"year"`
	Recurring *bool      `json:"recurring"`
	GivenOn   *string    `json:"given_on"`
	Occasion  *string    `json:"occasion"`
}

type Match struct {
	PersonID int64    `json:"person_id"`
	Note     string   `json:"note"`
	Changes  []Change `json:"changes"`
}

type Unknown struct {
	Name string `json:"name"`
	Text string `json:"text"`
}

type NoteResult struct {
	Matches []Match   `json:"matches"`
	Unknown []Unknown `json:"unknown"`
	Notes   string    `json:"notes"`
}

type NoteResponse struct {
	Transcript string    `json:"transcript"`
	Matches    []Match   `json:"matches"`
	Unknown    []Unknown `json:"unknown"`
	Notes      string    `json:"notes"`
}
