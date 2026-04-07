/** Avatar-style initials from a call centre name (matches BPO centre create preview). */
export function callCenterNameInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const firstWord = (trimmed.split(/[\s\-–—]+/)[0] ?? trimmed).replace(/[^a-zA-Z0-9]/g, "");
  if (firstWord.length > 0) {
    return firstWord.slice(0, 3).toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

/** Strip `Inactive:` prefix for display in UI. */
export function displayCallCenterName(raw: string): string {
  return raw.replace(/^Inactive:/i, "").trim();
}
