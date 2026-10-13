package live_test

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/tahardi/little-things/backend/internal/gcal"
	"github.com/tahardi/little-things/backend/internal/model"
)

func TestSyncer_Sync(t *testing.T) {
	// given
	credentials := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	calendarID := os.Getenv("LITTLETHINGS_TEST_CALENDAR_ID")
	if credentials == "" || calendarID == "" {
		t.Skip("GOOGLE_APPLICATION_CREDENTIALS or LITTLETHINGS_TEST_CALENDAR_ID not set")
	}
	ctx := context.Background()
	syncer, err := gcal.NewSyncer(ctx, credentials, calendarID)
	require.NoError(t, err)
	_, err = syncer.Sync(ctx, []model.CalendarDate{})
	require.NoError(t, err)
	date := model.CalendarDate{ID: 900001, Title: "Live test birthday", Month: 3, Day: 3, Recurring: true}
	renamed := date
	renamed.Title = "Live test birthday (renamed)"

	// when
	created, errCreate := syncer.Sync(ctx, []model.CalendarDate{date})
	again, errAgain := syncer.Sync(ctx, []model.CalendarDate{date})
	updated, errUpdate := syncer.Sync(ctx, []model.CalendarDate{renamed})
	deleted, errDelete := syncer.Sync(ctx, []model.CalendarDate{})

	// then
	require.NoError(t, errCreate)
	require.NoError(t, errAgain)
	require.NoError(t, errUpdate)
	require.NoError(t, errDelete)
	assert.Equal(t, model.CalendarResponse{Created: 1}, created)
	assert.Equal(t, model.CalendarResponse{}, again)
	assert.Equal(t, model.CalendarResponse{Updated: 1}, updated)
	assert.Equal(t, model.CalendarResponse{Deleted: 1}, deleted)
}
