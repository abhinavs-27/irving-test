/**
 * Derive SEC Item / pipeline section ids from paragraph clause ids (`{section}.p{n}`).
 */
/** Match `{sectionId}.p{n}` paragraph ids from `splitIntoParagraphs`. */
export declare function parseSectionIdFromClauseId(clauseId: string): string;
/** Material definitive agreement Item — higher expectations for parties/pricing signal. */
export declare function isMaterialDefinitiveItemSection(sectionId: string): boolean;
/** Structured Item body (not metadata/header/footer wrappers). */
export declare function isStructuredItemSection(sectionId: string): boolean;
export type LegalClauseTypeHint = 'pricing_terms' | 'payment' | 'obligations' | 'constraints' | 'termination';
export declare function sectionSuggestsClauseTypes(sectionId: string): LegalClauseTypeHint[];
//# sourceMappingURL=section-context.d.ts.map