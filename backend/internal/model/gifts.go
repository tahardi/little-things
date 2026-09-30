package model

type GiftsRequest struct {
	Name          string   `json:"name"`
	PreferredName *string  `json:"preferred_name"`
	Relationship  *string  `json:"relationship"`
	Interests     []string `json:"interests"`
	GiftIdeas     []string `json:"gift_ideas"`
	GiftsGiven    []string `json:"gifts_given"`
	Notes         []string `json:"notes"`
	Occasion      *string  `json:"occasion"`
}

type GiftIdea struct {
	Text string `json:"text"`
	Why  string `json:"why"`
}

type GiftsResponse struct {
	Ideas []GiftIdea `json:"ideas"`
}
