/**
 * SEC Layer 1 schema v2 — queryable, normalized, invariant-driven.
 */
export const ATOMIC_KIND_VALUES = [
    'structural',
    'pricing',
    'constraint',
    'termination',
    'disclosure',
];
export const LAYER1_BLOCK_TYPES = [
    'pricing_mechanism',
    'constraint',
    'structural',
    'termination',
    'regulatory_disclosure',
];
export const LEGAL_ROLE_VALUES = [
    'issuer',
    'purchaser',
    'counterparty',
];
/** Layer 1 graph edges (deterministic enum). */
export const KGRAPH_RELATIONSHIP_TYPES = [
    'defines',
    'constrains',
    'governs',
    'references',
    'triggers',
];
export const RELATIONSHIP_TYPES = KGRAPH_RELATIONSHIP_TYPES;
/** @deprecated v1 */
export const LEGACY_RELATIONSHIP_TYPES = ['applies_to', 'limits', 'modifies'];
export const ENTITY_ID_PREFIX = 'org:';
export const EVENT_ID_PREFIX = 'event:';
export const CONCEPT_ID_PREFIX = 'concept:';
export const CORE_CONCEPT_IDS = [
    `${CONCEPT_ID_PREFIX}intraday_purchase`,
    `${CONCEPT_ID_PREFIX}regular_purchase`,
    `${CONCEPT_ID_PREFIX}aggregate_ownership`,
    `${CONCEPT_ID_PREFIX}exchange_cap_issuance`,
    `${CONCEPT_ID_PREFIX}agreement_termination`,
];
export function isAtomicKind(v) {
    return typeof v === 'string' && ATOMIC_KIND_VALUES.includes(v);
}
export function isLayer1BlockType(v) {
    return typeof v === 'string' && LAYER1_BLOCK_TYPES.includes(v);
}
/** Maps each Layer 1 block to the paragraph `atomicKind` (v2). */
export function atomicKindForLayer1BlockType(t) {
    switch (t) {
        case 'pricing_mechanism':
            return 'pricing';
        case 'constraint':
            return 'constraint';
        case 'structural':
            return 'structural';
        case 'termination':
            return 'termination';
        case 'regulatory_disclosure':
            return 'disclosure';
    }
}
//# sourceMappingURL=types.js.map