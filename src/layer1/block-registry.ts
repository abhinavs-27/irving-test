import type { Clause } from '../clause/clause.js';
import type { BlockPricingModel, Layer1BlockType } from './types.js';
import { atomicKindForLayer1BlockType } from './types.js';

/** Mirrors `atomicKind` for blocks (Layer1BlockType → role string). */
export type Layer1SemanticRole =
  | 'structural'
  | 'pricing'
  | 'constraint'
  | 'termination'
  | 'disclosure';

export type BlockRegistryEntry = {
  id: string;
  type: Layer1BlockType;
  paragraph_ids: readonly string[];
  semantic_role: Layer1SemanticRole;
  pricing_model?: BlockPricingModel;
};

function semanticRoleForBlock(t: Layer1BlockType): Layer1SemanticRole {
  return atomicKindForLayer1BlockType(t) as Layer1SemanticRole;
}

/**
 * Flatten all section blocks into `block_registry` with semantic_role and optional pricing_model.
 */
export function buildBlockRegistry(
  sections: Clause[],
  pricingByBlockId: ReadonlyMap<string, BlockPricingModel>,
): Record<string, BlockRegistryEntry> {
  const out: Record<string, BlockRegistryEntry> = {};
  for (const s of sections) {
    for (const b of s.blocks ?? []) {
      const pm = pricingByBlockId.get(b.id);
      out[b.id] = {
        id: b.id,
        type: b.type,
        paragraph_ids: [...b.paragraph_ids],
        semantic_role: semanticRoleForBlock(b.type),
        ...(pm ? { pricing_model: pm } : {}),
      };
    }
  }
  return out;
}

export function findBlockIdContainingParagraph(
  sections: Clause[],
  paragraphId: string,
): string | undefined {
  for (const s of sections) {
    for (const b of s.blocks ?? []) {
      if (b.paragraph_ids.includes(paragraphId)) return b.id;
    }
  }
  return undefined;
}

export function paragraphToBlockMap(
  sections: Clause[],
): ReadonlyMap<string, string> {
  const m = new Map<string, string>();
  for (const s of sections) {
    for (const b of s.blocks ?? []) {
      for (const pid of b.paragraph_ids) {
        m.set(pid, b.id);
      }
    }
  }
  return m;
}
