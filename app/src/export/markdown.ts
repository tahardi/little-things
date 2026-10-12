import type { DateRow, GiftGivenRow, PersonDetail } from '@/db/types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function oneLine(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, ' ').trim();
}

export function formatMonthDay(month: number, day: number, year: number | null): string {
  const monthDay = `${pad(month)}/${pad(day)}`;
  return year === null ? monthDay : `${monthDay}/${year}`;
}

export function localDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function field(label: string, value: string | null): string {
  return value ? `**${label}** ${oneLine(value)}` : `**${label}**`;
}

function section(heading: string, items: string[]): string {
  return [`#### ${heading}`, ...items.map((item) => `- ${oneLine(item)}`)].join('\n');
}

function giftGiven(gift: GiftGivenRow): string {
  const details = [gift.givenOn, gift.occasion].filter((value): value is string => value !== null);
  return details.length > 0 ? `${gift.text} (${details.join(', ')})` : gift.text;
}

function otherDate(date: DateRow): string {
  return `${date.label}: ${formatMonthDay(date.month, date.day, date.year)}${date.recurring ? ' (yearly)' : ''}`;
}

function personMarkdown(person: PersonDetail): string {
  const birthday = person.dates.find((date) => date.kind === 'birthday');
  const fields = [
    `## ${oneLine(person.name)}`,
    field('Birthday', birthday ? formatMonthDay(birthday.month, birthday.day, birthday.year) : null),
    field('Address', person.address),
    field('Phone', person.phone),
    field('Preferred Name', person.preferredName),
    field('Nicknames', person.nicknames.map((nickname) => nickname.text).join(', ') || null),
    field('Relationship', person.relationship),
  ].join('\n');
  return [
    fields,
    section(
      'Info & Interests',
      person.interests.map((interest) => interest.text),
    ),
    section(
      'Presents',
      person.giftIdeas.map((idea) => idea.text),
    ),
    section('Gifts Given', person.giftsGiven.map(giftGiven)),
    section('Dates', person.dates.filter((date) => date.kind === 'other').map(otherDate)),
    section(
      'Notes',
      person.notes.map((note) => `${localDate(note.createdAt)}: ${note.text}`),
    ),
  ].join('\n\n');
}

export function toMarkdown(people: PersonDetail[]): string {
  if (people.length === 0) {
    return '';
  }
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return sorted.map(personMarkdown).join('\n\n') + '\n';
}
