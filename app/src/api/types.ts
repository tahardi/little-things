export type Field =
  'name' | 'preferred_name' | 'nicknames' | 'relationship' | 'birthday' | 'address' | 'phone' | 'interests';

export type Birthday = { month: number; day: number; year: number | null };

export type FieldValue = string | string[] | Birthday;

export type FieldResponse = { transcript: string; value: FieldValue };

export type ApiPerson = {
  id: number;
  name: string;
  preferred_name: string | null;
  nicknames: string[];
  relationship: string | null;
};

export type ChangeType =
  | 'add_interest'
  | 'add_gift_idea'
  | 'add_gift_given'
  | 'set_birthday'
  | 'add_date'
  | 'set_address'
  | 'set_phone'
  | 'set_relationship'
  | 'set_preferred_name'
  | 'add_nickname';

export type Change = {
  type: ChangeType;
  text: string | null;
  label: string | null;
  month: number | null;
  day: number | null;
  year: number | null;
  recurring: boolean | null;
  given_on: string | null;
  occasion: string | null;
};

export type Match = { person_id: number; note: string; changes: Change[] };

export type Unknown = { name: string; text: string };

export type NoteResponse = { transcript: string; matches: Match[]; unknown: Unknown[]; notes: string };

export type GiftsRequest = {
  name: string;
  preferred_name: string | null;
  relationship: string | null;
  interests: string[];
  gift_ideas: string[];
  gifts_given: string[];
  notes: string[];
  occasion: string | null;
};

export type GiftIdea = { text: string; why: string };

export type GiftsResponse = { ideas: GiftIdea[] };

export type HealthResponse = { status: string };

export type ErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'payload_too_large'
  | 'no_speech'
  | 'unreadable_date'
  | 'upstream_failed'
  | 'unreachable';
