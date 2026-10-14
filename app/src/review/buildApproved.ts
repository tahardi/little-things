import type { Change, NoteResponse } from '@/api/types';
import type { ApprovedMatch } from '@/db/types';

export type ChangeDecision = { change: Change; approved: boolean };
export type MatchDraft = { personId: number; note: string; changes: ChangeDecision[] };

export function toDrafts(result: NoteResponse): MatchDraft[] {
  return result.matches.map((m) => ({
    personId: m.person_id,
    note: m.note,
    changes: m.changes.map((change) => ({ change, approved: true })),
  }));
}

export function buildApproved(drafts: MatchDraft[]): ApprovedMatch[] {
  return drafts
    .map((d) => ({
      personId: d.personId,
      note: d.note.trim(),
      changes: d.changes.filter((c) => c.approved).map((c) => c.change),
    }))
    .filter((m) => m.note !== '' || m.changes.length > 0);
}

export function hasEditableText(change: Change): boolean {
  return change.type !== 'set_birthday' && change.type !== 'add_date';
}

function formatDate(month: number | null, day: number | null, year: number | null): string {
  const md = `${month}/${day}`;
  return year === null ? md : `${md}/${year}`;
}

export function describeChange(change: Change): string {
  const text = change.text ?? '';
  switch (change.type) {
    case 'add_interest':
      return `Interest: ${text}`;
    case 'add_gift_idea':
      return `Gift idea: ${text}`;
    case 'add_gift_given': {
      const extra = [change.given_on, change.occasion].filter((part) => part !== null);
      return extra.length === 0 ? `Gift given: ${text}` : `Gift given: ${text} (${extra.join(', ')})`;
    }
    case 'set_birthday':
      return `Birthday: ${formatDate(change.month, change.day, change.year)}`;
    case 'add_date':
      return `${change.label ?? ''}: ${formatDate(change.month, change.day, change.year)} (${change.recurring ? 'yearly' : 'once'})`;
    case 'set_address':
      return `Address: ${text}`;
    case 'set_phone':
      return `Phone: ${text}`;
    case 'set_relationship':
      return `Relationship: ${text}`;
    case 'set_preferred_name':
      return `Preferred name: ${text}`;
    case 'add_nickname':
      return `Nickname: ${text}`;
  }
}
