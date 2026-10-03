export function clean(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export function requireText(text: string | null | undefined): string {
  const cleaned = clean(text);
  if (cleaned === null) {
    throw new Error('text is required');
  }
  return cleaned;
}
