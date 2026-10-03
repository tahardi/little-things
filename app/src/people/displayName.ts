export function displayName(p: { name: string; preferredName: string | null }): string {
  return p.preferredName ?? p.name;
}
