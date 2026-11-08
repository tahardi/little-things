import type { ErrorCode, GiftsRequest } from '@/api/types';
import type { PersonDetail } from '@/db/types';

export const MAX_NOTES = 50;

export function toGiftsRequest(person: PersonDetail, occasion: string): GiftsRequest {
  const trimmed = occasion.trim();
  return {
    name: person.name,
    preferred_name: person.preferredName,
    relationship: person.relationship,
    interests: person.interests.map((i) => i.text),
    gift_ideas: person.giftIdeas.map((g) => g.text),
    gifts_given: person.giftsGiven.map((g) => g.text),
    notes: person.notes.slice(0, MAX_NOTES).map((n) => n.text),
    occasion: trimmed === '' ? null : trimmed,
  };
}

export function giftsErrorMessage(code: ErrorCode): string {
  switch (code) {
    case 'unreachable':
      return "Can't reach the backend. Try again when it's on.";
    case 'unauthorized':
      return 'The backend key is wrong. Check Settings.';
    default:
      return 'The backend had a problem. Try again.';
  }
}
