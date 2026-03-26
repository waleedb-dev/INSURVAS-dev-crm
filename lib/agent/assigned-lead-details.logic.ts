/** Human-readable label for snake_case field keys (e.g. `phone_number` → `Phone Number`). */
export function titleizeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "Field";
  return trimmed
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
