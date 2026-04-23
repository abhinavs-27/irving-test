import type { Clause } from './clause.js';
/**
 * Pass 1 result: one detected clause header.
 */
export type ClauseMatch = {
    id: string;
    title: string;
    /** Character offset of the start of the line containing this header (full `text`). */
    start: number;
};
/**
 * Two-pass extraction: (1) line-anchored header matches with offsets; (2) slice text between headers.
 * Biased toward recall; refine precision with filters/logging later.
 */
export declare function extractClauses(text: string): Clause[];
//# sourceMappingURL=extract.d.ts.map