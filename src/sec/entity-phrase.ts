/**
 * Heuristic filter for plausible party names (used by consumers; not Layer 1 classification).
 */

export function isValidEntityPhrase(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 140) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (
    /\b(?:will|would|shall|must|may|might|could|should|has|have|had|is|are|was|were)\s+(?:the\s+)?(?:right|obligation|no\s+obligation)\b/i.test(
      t,
    )
  )
    return false;
  if (
    /\b(?:under\s+no\s+obligation|pursuant\s+to|in\s+accordance\s+with)\b/i.test(t)
  )
    return false;
  if (
    /\b(?:sell\s+to|sell\s+any\s+securities)\b/i.test(t) &&
    t.split(/\s+/).length > 8
  )
    return false;
  if (/^[a-z]/.test(t) && !/^mc[A-Z]/i.test(t)) return false;
  const words = t.split(/\s+/).length;
  if (words > 18) return false;
  if (/^[^A-Za-z"]+$/.test(t)) return false;
  return true;
}
