package gcal

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/calendar/v3"

	"github.com/tahardi/little-things/backend/internal/model"
)

var errBoom = errors.New("boom")

type fakeEvents struct {
	items   []*calendar.Event
	nextID  int
	failOn  string
	deleted []string
}

func (f *fakeEvents) fail(op string) error {
	if f.failOn == op {
		return errBoom
	}
	return nil
}

func (f *fakeEvents) list(_ context.Context) ([]*calendar.Event, error) {
	return f.items, f.fail("list")
}

func (f *fakeEvents) insert(_ context.Context, event *calendar.Event) error {
	if err := f.fail("insert"); err != nil {
		return err
	}
	f.nextID++
	event.Id = fmt.Sprintf("new%d", f.nextID)
	f.items = append(f.items, event)
	return nil
}

func (f *fakeEvents) update(_ context.Context, id string, event *calendar.Event) error {
	if err := f.fail("update"); err != nil {
		return err
	}
	for i, e := range f.items {
		if e.Id == id {
			event.Id = id
			f.items[i] = event
		}
	}
	return nil
}

func (f *fakeEvents) delete(_ context.Context, id string) error {
	if err := f.fail("delete"); err != nil {
		return err
	}
	f.deleted = append(f.deleted, id)
	kept := f.items[:0]
	for _, e := range f.items {
		if e.Id != id {
			kept = append(kept, e)
		}
	}
	f.items = kept
	return nil
}

func fixedNow() time.Time { return time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC) }

func TestSyncer_Sync(t *testing.T) {
	sam := model.CalendarDate{ID: 12, Title: "Sam's birthday", Month: 3, Day: 3, Recurring: true}
	samRenamed := sam
	samRenamed.Title = "Sammy's birthday"
	maggie := model.CalendarDate{
		ID: 11, Title: "Maggie's birthday", Month: 10, Day: 11, Year: new(1994), Recurring: true,
	}
	priya := model.CalendarDate{ID: 13, Title: "Priya: surgery", Month: 11, Day: 20, Year: new(2026)}

	t.Run("happy path - creates updates deletes and counts", func(t *testing.T) {
		// given
		fake := &fakeEvents{items: []*calendar.Event{existing("e1", sam), existing("e2", priya)}}
		syncer := &Syncer{events: fake, now: fixedNow}

		// when
		got, err := syncer.Sync(context.Background(), []model.CalendarDate{samRenamed, maggie})

		// then
		require.NoError(t, err)
		assert.Equal(t, model.CalendarResponse{Created: 1, Updated: 1, Deleted: 1}, got)
		assert.Equal(t, []string{"e2"}, fake.deleted)
		assert.Len(t, fake.items, 2)
	})

	t.Run("happy path - second sync is a no-op", func(t *testing.T) {
		// given
		fake := &fakeEvents{}
		syncer := &Syncer{events: fake, now: fixedNow}
		_, err := syncer.Sync(context.Background(), []model.CalendarDate{sam, maggie})
		require.NoError(t, err)

		// when
		got, err := syncer.Sync(context.Background(), []model.CalendarDate{sam, maggie})

		// then
		require.NoError(t, err)
		assert.Equal(t, model.CalendarResponse{}, got)
	})

	for _, op := range []string{"list", "insert", "update", "delete"} {
		t.Run("error - "+op+" fails", func(t *testing.T) {
			// given
			fake := &fakeEvents{
				items:  []*calendar.Event{existing("e1", sam), existing("e2", priya)},
				failOn: op,
			}
			syncer := &Syncer{events: fake, now: fixedNow}

			// when
			_, err := syncer.Sync(context.Background(), []model.CalendarDate{samRenamed, maggie})

			// then
			assert.ErrorIs(t, err, errBoom)
		})
	}
}
