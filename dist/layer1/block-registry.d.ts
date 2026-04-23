import type { Clause } from '../clause/clause.js';
import type { BlockPricingModel, Layer1BlockType } from './types.js';
/** Mirrors `atomicKind` for blocks (Layer1BlockType → role string). */
export type Layer1SemanticRole = 'structural' | 'pricing' | 'constraint' | 'termination' | 'disclosure';
export type BlockRegistryEntry = {
    id: string;
    type: Layer1BlockType;
    paragraph_ids: readonly string[];
    semantic_role: Layer1SemanticRole;
    pricing_model?: BlockPricingModel;
};
/**
 * Flatten all section blocks into `block_registry` with semantic_role and optional pricing_model.
 */
export declare function buildBlockRegistry(sections: Clause[], pricingByBlockId: ReadonlyMap<string, BlockPricingModel>): Record<string, BlockRegistryEntry>;
export declare function findBlockIdContainingParagraph(sections: Clause[], paragraphId: string): string | undefined;
export declare function paragraphToBlockMap(sections: Clause[]): ReadonlyMap<string, string>;
//# sourceMappingURL=block-registry.d.ts.map