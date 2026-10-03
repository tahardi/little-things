import type { Birthday, Change, NoteResponse } from '@/api/types';

export type Person = {
  id: number;
  name: string;
  preferredName: string | null;
  relationship: string | null;
  address: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Item = { id: number; text: string };

export type GiftIdeaRow = { id: number; text: string; source: 'voice' | 'ai' | 'manual'; createdAt: string };

export type GiftGivenRow = {
  id: number;
  text: string;
  givenOn: string | null;
  occasion: string | null;
  createdAt: string;
};

export type DateKind = 'birthday' | 'other';

export type DateRow = {
  id: number;
  personId: number;
  kind: DateKind;
  label: string;
  month: number;
  day: number;
  year: number | null;
  recurring: boolean;
  calendarEventId: string | null;
};

export type DateWithPerson = DateRow & { displayName: string };

export type NoteRow = { id: number; personId: number; text: string; createdAt: string; clipId: number | null };

export type PersonDetail = Person & {
  nicknames: Item[];
  interests: Item[];
  giftIdeas: GiftIdeaRow[];
  giftsGiven: GiftGivenRow[];
  dates: DateRow[];
  notes: NoteRow[];
};

export type ClipStatus = 'queued' | 'processing' | 'review' | 'done';

export type Clip = {
  id: number;
  fileUri: string;
  status: ClipStatus;
  error: string | null;
  result: NoteResponse | null;
  createdAt: string;
};

export type NewPerson = {
  name: string;
  preferredName: string | null;
  nicknames: string[];
  relationship: string | null;
  birthday: Birthday | null;
  address: string | null;
  phone: string | null;
  interests: string[];
  notes: string[];
};

export type PersonPatch = Partial<Pick<Person, 'name' | 'preferredName' | 'relationship' | 'address' | 'phone'>>;

export type NewDate = {
  kind: DateKind;
  label: string;
  month: number;
  day: number;
  year: number | null;
  recurring: boolean;
};

export type ApprovedMatch = { personId: number; note: string; changes: Change[] };
