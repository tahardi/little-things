import type { Change } from '@/api/types';
import { isValidMonthDay } from '@/dates/valid';

import { clean } from './clean';
import { markClipDone } from './clips';
import { addDate, setBirthday } from './dates';
import type { Db } from './db';
import { addGiftGiven, addGiftIdea } from './gifts';
import { addNote } from './notes';
import { addInterest, addNickname, updatePerson } from './people';
import type { ApprovedMatch } from './types';

function usable(c: Change): boolean {
  switch (c.type) {
    case 'set_birthday':
      return c.month !== null && c.day !== null && isValidMonthDay(c.month, c.day);
    case 'add_date':
      return (
        clean(c.label) !== null &&
        c.recurring !== null &&
        c.month !== null &&
        c.day !== null &&
        isValidMonthDay(c.month, c.day)
      );
    default:
      return clean(c.text) !== null;
  }
}

async function applyChange(txn: Db, personId: number, c: Change, now: Date): Promise<void> {
  const text = clean(c.text) ?? '';
  switch (c.type) {
    case 'add_interest':
      await addInterest(txn, personId, text);
      return;
    case 'add_nickname':
      await addNickname(txn, personId, text);
      return;
    case 'add_gift_idea':
      await addGiftIdea(txn, personId, text, 'voice', now);
      return;
    case 'add_gift_given':
      await addGiftGiven(txn, personId, text, clean(c.given_on), clean(c.occasion), now);
      return;
    case 'set_birthday':
      await setBirthday(txn, personId, { month: c.month as number, day: c.day as number, year: c.year });
      return;
    case 'add_date':
      await addDate(txn, personId, {
        kind: 'other',
        label: clean(c.label) as string,
        month: c.month as number,
        day: c.day as number,
        year: c.year,
        recurring: c.recurring as boolean,
      });
      return;
    case 'set_address':
      await updatePerson(txn, personId, { address: text }, now);
      return;
    case 'set_phone':
      await updatePerson(txn, personId, { phone: text }, now);
      return;
    case 'set_relationship':
      await updatePerson(txn, personId, { relationship: text }, now);
      return;
    case 'set_preferred_name':
      await updatePerson(txn, personId, { preferredName: text }, now);
      return;
  }
}

export async function applyReview(db: Db, clipId: number, matches: ApprovedMatch[], now: Date): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const clip = await txn.getFirstAsync<{ status: string }>('SELECT status FROM clips WHERE id = ?', clipId);
    if (clip?.status !== 'review') {
      throw new Error('clip is not in review');
    }
    for (const match of matches) {
      const person = await txn.getFirstAsync<{ id: number }>('SELECT id FROM people WHERE id = ?', match.personId);
      if (!person) {
        continue;
      }
      if (clean(match.note) !== null) {
        await addNote(txn, match.personId, match.note, now, clipId);
      }
      for (const c of match.changes.filter(usable)) {
        await applyChange(txn, match.personId, c, now);
      }
    }
    await markClipDone(txn, clipId);
  });
}
