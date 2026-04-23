import type { Clause } from '../clause/clause.js';
import type { BlockRegistryEntry } from './block-registry.js';
import type { GraphEvent } from './types.js';
import type { Layer1GraphPayload } from './layer1-graph-compile.js';
/**
 * Contract: when `pricing_model` is present, it must include `method: VWAP` and full modes.
 * Drops `pricing_model` if discount cannot be resolved for all modes.
 */
export declare function finalizePricingInBlockRegistry(block_registry: Record<string, BlockRegistryEntry>, sections: Clause[]): void;
export declare function enrichTerminationEvents(events: GraphEvent[], sections: Clause[]): void;
export declare function ensureParagraphAtomicKinds(sections: Clause[]): void;
export declare function augmentConstraintParagraphFacts(sections: Clause[]): void;
export declare function ensureRelationshipCompleteness(payload: Layer1GraphPayload, sections: Clause[]): void;
export declare function applyExtractionContractFixes(sections: Clause[], payload: Layer1GraphPayload): void;
//# sourceMappingURL=extraction-contract-fix.d.ts.map