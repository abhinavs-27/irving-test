/**
 * Derive SEC Item / pipeline section ids from paragraph clause ids (`{section}.p{n}`).
 */

/** Match `{sectionId}.p{n}` paragraph ids from `splitIntoParagraphs`. */
export function parseSectionIdFromClauseId(clauseId: string): string {
  const m = clauseId.match(/^(.+)\.p\d+$/i);
  if (m) return m[1]!;
  const parts = clauseId.split('.');
  if (parts.length >= 2 && /^p\d+$/i.test(parts[parts.length - 1]!))
    return parts.slice(0, -1).join('.');
  return clauseId;
}

/** Material definitive agreement Item — higher expectations for parties/pricing signal. */
export function isMaterialDefinitiveItemSection(sectionId: string): boolean {
  return /^1\.01\b/.test(sectionId) || sectionId === '1.01';
}

/** Structured Item body (not metadata/header/footer wrappers). */
export function isStructuredItemSection(sectionId: string): boolean {
  return /^\d+\.\d{2}$/.test(sectionId);
}

export type LegalClauseTypeHint =
  | 'pricing_terms'
  | 'payment'
  | 'obligations'
  | 'constraints'
  | 'termination';

export function sectionSuggestsClauseTypes(
  sectionId: string,
): LegalClauseTypeHint[] {
  const hints: LegalClauseTypeHint[] = [];
  if (isMaterialDefinitiveItemSection(sectionId)) {
    hints.push('pricing_terms', 'obligations', 'payment');
  }
  if (/^3\.02\b/.test(sectionId)) hints.push('payment', 'constraints');
  if (/^9\.01\b/.test(sectionId)) hints.push('obligations');
  return hints;
}
