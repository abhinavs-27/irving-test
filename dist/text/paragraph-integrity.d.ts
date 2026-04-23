import type { Clause } from '../clause/clause.js';
/**
 * Detect paragraph text that likely continues on the next PDF/layout fragment.
 */
export declare function paragraphEndsIncomplete(text: string): boolean;
/**
 * Merge adjacent paragraph clauses when the first ends mid-sentence / mid-parenthesis.
 * Renumbers ids as `{sectionId}.p1`, … in order.
 */
export declare function mergeIncompleteParagraphs(sectionId: string, paras: Clause[]): Clause[];
//# sourceMappingURL=paragraph-integrity.d.ts.map