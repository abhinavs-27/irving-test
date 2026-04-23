/**
 * Fix PDF line-wrap artifacts inside one logical paragraph.
 * Preserves real paragraph breaks expressed as blank lines (`\n\n`).
 */

function normalizeSpaces(s: string): string {
  return s.replace(/[^\S\r\n]+/g, ' ');
}

/**
 * Merge soft single-newline breaks within one `\n\n`-delimited region:
 * - Trailing hyphen-de hyphenation (`part-\nword` → `partword`).
 * - All other intra-part newlines → single space (mid-sentence PDF wraps; keeps periods, parens, citations intact).
 */
function normalizeMajorPart(part: string): string {
  const lines = part.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return '';
  if (lines.length === 1) return normalizeSpaces(lines[0]!);

  let acc = lines[0]!;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (acc.endsWith('-')) {
      acc = acc.slice(0, -1) + line;
    } else {
      acc = `${acc} ${line}`;
    }
  }

  return normalizeSpaces(acc);
}

/**
 * Normalize paragraph text for retrieval / display.
 *
 * - Keeps `\n\n` as structural paragraph separators only.
 * - Within each separator region, merges broken lines (see `normalizeMajorPart`).
 * - Collapses multiple spaces to one; does not remove parentheses, numbers, or quote marks used for defined terms.
 */
export function normalizeParagraphText(text: string): string {
  const majorParts = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (majorParts.length === 0) return '';

  const rebuilt = majorParts.map(normalizeMajorPart).join('\n\n');
  return normalizeSpaces(rebuilt).trim();
}
