import { atomicKindForLayer1BlockType } from './types.js';
function semanticRoleForBlock(t) {
    return atomicKindForLayer1BlockType(t);
}
/**
 * Flatten all section blocks into `block_registry` with semantic_role and optional pricing_model.
 */
export function buildBlockRegistry(sections, pricingByBlockId) {
    const out = {};
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
export function findBlockIdContainingParagraph(sections, paragraphId) {
    for (const s of sections) {
        for (const b of s.blocks ?? []) {
            if (b.paragraph_ids.includes(paragraphId))
                return b.id;
        }
    }
    return undefined;
}
export function paragraphToBlockMap(sections) {
    const m = new Map();
    for (const s of sections) {
        for (const b of s.blocks ?? []) {
            for (const pid of b.paragraph_ids) {
                m.set(pid, b.id);
            }
        }
    }
    return m;
}
//# sourceMappingURL=block-registry.js.map