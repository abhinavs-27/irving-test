import type { Clause, SemanticBlock } from '../clause/clause.js';
import type { BlockPricingModel } from './types.js';
/**
 * Block-level `pricing_model`: literal fields from cited paragraphs (no free-text formula).
 */
export declare function buildPricingModelForBlock(_sectionId: string, block: SemanticBlock, paragraphById: Map<string, Clause>): BlockPricingModel | undefined;
export declare function buildBlockPricingModelMap(sectionId: string, section: Clause, paragraphById: Map<string, Clause>): Map<string, BlockPricingModel>;
//# sourceMappingURL=pricing-model.d.ts.map