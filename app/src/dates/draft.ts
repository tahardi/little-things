import { isValidMonthDay } from '@/dates/valid';

export type DateDraft = { month: string; day: string; year: string };
export type ParsedDate = { month: number; day: number; year: number | null };

export function parseDateDraft(draft: DateDraft): ParsedDate | null {
  const month = draft.month.trim();
  const day = draft.day.trim();
  const year = draft.year.trim();
  if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return null;
  }
  if (!isValidMonthDay(Number(month), Number(day))) {
    return null;
  }
  if (year === '') {
    return { month: Number(month), day: Number(day), year: null };
  }
  if (!/^\d{4}$/.test(year)) {
    return null;
  }
  return { month: Number(month), day: Number(day), year: Number(year) };
}
