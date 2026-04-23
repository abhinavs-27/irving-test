import type { Clause } from '../clause/clause.js';
import type { ClauseUnderstandingRecord } from './types.js';
/**
 * Exactly one canonical understanding object per paragraph clause node.
 * `semantic_block_id` is a placeholder until `understandDocument` post-processes.
 */
export declare function understandAtomicClause(clause: Clause, documentContextText?: string): ClauseUnderstandingRecord | null;
export declare function collectParagraphClauses(sections: Clause[]): Clause[];
/**
 * One JSON object per unique `clause_id` (deduped; first occurrence wins),
 * then duplicate-merge and semantic block assignment.
 */
export declare function understandDocument(sections: Clause[]): ClauseUnderstandingRecord[];
//# sourceMappingURL=understand.d.ts.map