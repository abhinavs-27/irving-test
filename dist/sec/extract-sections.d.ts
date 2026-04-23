import type { Clause } from '../clause/clause.js';
export type SecItemMatch = {
    id: string;
    title: string;
    start: number;
};
/**
 * Semantic segmentation for SEC filings: metadata header, Item N.NN sections, signature/footer.
 * Uses two passes: detect headers with offsets, then slice text. Titles only from Item lines.
 */
export declare function extractSections(text: string): Clause[];
/** Prefer `splitIntoParagraphs`; contract clause parsing can extend this later. */
export declare function parseSectionInnerClauses(section: Clause): Clause[];
//# sourceMappingURL=extract-sections.d.ts.map