import type { ClauseBlock } from './normalized-clause.js';
/** Canonical top-level key order for ClauseBlock JSON (v2 production). */
export declare const LAYER2_CLAUSE_BLOCK_JSON_KEYS: readonly ["clause_id", "clause_type", "source_block_id", "source_paragraph_ids", "primary_entity_id", "counterparty_entity_ids", "event_ids", "event_kinds", "relationships", "extracted_fields", "confidence", "priority"];
/**
 * Returns a new {@link ClauseBlock} with canonical key order and sorted string arrays
 * for diff-stable JSON serialization.
 */
export declare function normalizeClauseBlockOrder(block: ClauseBlock): ClauseBlock;
/**
 * Single-domain `extracted_fields`, allowlisted keys, and deterministic
 * `priority` from `clause_type`; then canonical key order (use before validation / JSON write).
 */
export declare function prepareLayer2ClauseForExport(block: ClauseBlock): ClauseBlock;
export declare function prepareLayer2ClausesForExport(blocks: readonly ClauseBlock[]): ClauseBlock[];
/** Stable JSON for Layer 2 clause arrays (2-space indent). */
export declare function stringifyLayer2ClausesStable(clauses: readonly ClauseBlock[]): string;
//# sourceMappingURL=layer2-clause-order.d.ts.map