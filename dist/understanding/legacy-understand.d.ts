/**
 * @deprecated Legacy Layer 2: per-paragraph NLP classification + semantic blocks (sbX).
 * Superseded by deterministic {@link projectNormalizedClausesFromLayer1} from Layer 1 blocks.
 * Kept for evaluation / regression only — not used by `analyze.ts`.
 */
import type { Clause } from '../clause/clause.js';
import type { ClauseUnderstandingRecord } from './types.js';
export declare function legacyUnderstandAtomicClause(clause: Clause, documentContextText?: string): ClauseUnderstandingRecord | null;
export declare function legacyUnderstandDocument(sections: Clause[]): ClauseUnderstandingRecord[];
export declare function collectParagraphClauses(sections: Clause[]): Clause[];
//# sourceMappingURL=legacy-understand.d.ts.map