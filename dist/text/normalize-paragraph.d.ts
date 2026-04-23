/**
 * Fix PDF line-wrap artifacts inside one logical paragraph.
 * Preserves real paragraph breaks expressed as blank lines (`\n\n`).
 */
/**
 * Normalize paragraph text for retrieval / display.
 *
 * - Keeps `\n\n` as structural paragraph separators only.
 * - Within each separator region, merges broken lines (see `normalizeMajorPart`).
 * - Collapses multiple spaces to one; does not remove parentheses, numbers, or quote marks used for defined terms.
 */
export declare function normalizeParagraphText(text: string): string;
//# sourceMappingURL=normalize-paragraph.d.ts.map