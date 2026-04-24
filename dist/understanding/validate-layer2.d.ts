import type { ClauseBlock } from './normalized-clause.js';
/**
 * Hard validation for Layer 2 v2 projection output. Throws on first violation batch (single Error).
 */
export declare function assertLayer2ClauseBlock(record: ClauseBlock): void;
/**
 * Filing-level: termination domain only on termination clauses; each termination field
 * owned by at most one clause (canonical merge must run before this).
 */
export declare function assertLayer2FilingCanonicalOwnership(records: readonly ClauseBlock[]): void;
export declare function assertLayer2ClauseBlocks(records: readonly ClauseBlock[]): void;
//# sourceMappingURL=validate-layer2.d.ts.map