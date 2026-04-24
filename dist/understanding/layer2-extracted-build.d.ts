import type { BlockRegistryEntry } from '../layer1/block-registry.js';
import type { FilingSectionNode } from '../layer1/filing-types.js';
import type { BlockPricingModel, FactsV2, GraphEvent, SectionConstraintEntry } from '../layer1/types.js';
import type { ConstraintSchema, DisclosureSchema, ExtractedFields, NormalizedClauseType, PricingSchema, StructuralSchema, TerminationSchema } from './normalized-clause.js';
/** v2: block-level and per-mode `discount_rate` when Layer 1 provides them. */
export declare function buildPricingSchema(block: BlockRegistryEntry, merged: FactsV2 | undefined, pm: BlockPricingModel | undefined, paraById: Map<string, FilingSectionNode>): PricingSchema;
export declare function buildConstraintSchema(rows: SectionConstraintEntry[], merged: FactsV2 | undefined, issuerId: string, counterpartyIds: string[]): ConstraintSchema;
export declare function buildTerminationSchema(merged: FactsV2 | undefined): TerminationSchema;
export declare function buildDisclosureSchema(merged: FactsV2 | undefined): DisclosureSchema;
/** ISO dates only (no economic fields). */
export declare function buildStructuralSchema(merged: FactsV2 | undefined, executionDateIso: string | undefined): StructuralSchema;
export declare function buildExtractedFieldsForBlock(clause_type: NormalizedClauseType, block: BlockRegistryEntry, mergedFacts: FactsV2 | undefined, relevantConstraints: SectionConstraintEntry[], paraById: Map<string, FilingSectionNode>, linkedEvents: GraphEvent[], issuerId: string, counterpartyEntityIds: string[]): ExtractedFields;
/** Omit empty domain objects; if nothing remains, `{}`. */
export declare function pruneEmptyExtractedFields(ef: ExtractedFields): ExtractedFields;
export { mergeFacts, isNonEmptyFacts } from './layer2-normalize.js';
//# sourceMappingURL=layer2-extracted-build.d.ts.map