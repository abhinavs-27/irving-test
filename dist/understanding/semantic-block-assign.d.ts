import type { ClauseUnderstandingRecord } from './types.js';
import type { ClauseWork } from './dedupe-merge.js';
/**
 * One semantic block per **contiguous run** of same `(section_id, clause_type)` in document order.
 * Each clause appears in exactly one block; ids are stable per section (`{section}.sb{n}`).
 */
export declare function assignSemanticBlocks(rows: ClauseWork[]): ClauseUnderstandingRecord[];
//# sourceMappingURL=semantic-block-assign.d.ts.map