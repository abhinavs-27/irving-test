import type { ClauseUnderstandingRecord } from './types.js';
export type ClauseWork = {
    record: ClauseUnderstandingRecord;
    text: string;
};
/** Jaccard similarity on word sets (deterministic). */
export declare function tokenJaccardSimilarity(a: string, b: string): number;
/**
 * Merge rows with same section + clause_type when text overlaps strongly (≥80% Jaccard or substring core).
 * Survivor is the earlier document-order row; merged clause ids captured in `debug.merged_with`.
 */
export declare function dedupeUnderstandingRecords(rows: ClauseWork[]): ClauseWork[];
//# sourceMappingURL=dedupe-merge.d.ts.map