package model

type CalendarDate struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Month     int    `json:"month"`
	Day       int    `json:"day"`
	Year      *int   `json:"year"`
	Recurring bool   `json:"recurring"`
}

type CalendarRequest struct {
	Dates []CalendarDate `json:"dates"`
}

type CalendarResponse struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
	Deleted int `json:"deleted"`
}
