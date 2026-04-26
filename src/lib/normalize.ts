/** Normalize user/expected English for fuzzy equality (prototype-level). */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"«»„“”]/g, '')
}

export function answersMatch(user: string, expected: string): boolean {
  const u = normalizeAnswer(user)
  const e = normalizeAnswer(expected)
  if (!u || !e) return false
  if (u === e) return true
  const variants = e
    .split('/')
    .map((x) => normalizeAnswer(x))
    .filter(Boolean)
  return variants.some((v) => v === u)
}
