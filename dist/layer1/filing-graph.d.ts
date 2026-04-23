import type { Layer1Filing } from './filing-types.js';
import type { GraphEvent, SectionConstraintEntry } from './types.js';
export type AgreementLifecycle = {
    agreement_execution?: GraphEvent;
    agreement_termination?: GraphEvent;
    pricing_block_ids: string[];
    constraint_block_ids: string[];
    structural_block_ids: string[];
    termination_block_ids: string[];
    /** Ordered chain: execution (if any) → pricing blocks → constraint → termination (if any) */
    ordered_block_chain: string[];
};
/** Entity → block ids that `defines` / `constrains` / `governs` (via paragraphs) touch the org. */
export declare function blocksLinkedToEntity(filing: Layer1Filing, entityId: string): string[];
/** Paragraph ids in blocks that `defines`/`constrains` the entity, plus paragraphs citing `counterparty_id`. */
export declare function paragraphsLinkedToEntity(filing: Layer1Filing, entityId: string): string[];
/** Events whose `source_block_ids` include `blockId`. */
export declare function eventsForBlock(filing: Layer1Filing, blockId: string): GraphEvent[];
/** Events triggered by block via `triggers` relationship. */
export declare function eventsTriggeredByBlock(filing: Layer1Filing, blockId: string): GraphEvent[];
/** All section-level constraint rows that mention `entityId` (counterparty or issuer heuristics). */
export declare function constraintsAffectingEntity(filing: Layer1Filing, entityId: string): SectionConstraintEntry[];
/** Full agreement lifecycle summary for narrative Items (e.g. 1.01). */
export declare function agreementLifecycleChain(filing: Layer1Filing): AgreementLifecycle;
//# sourceMappingURL=filing-graph.d.ts.map