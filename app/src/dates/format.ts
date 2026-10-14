function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatMonthDay(month: number, day: number, year: number | null): string {
  const base = `${pad(month)}/${pad(day)}`;
  return year === null ? base : `${base}/${year}`;
}

export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
