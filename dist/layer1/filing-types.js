/**
 * Strict TypeScript types for the persisted Layer 1 filing document
 * (`entity_registry`, `block_registry`, `events`, `relationships`, `sections`).
 * Aligns with `schemas/layer1-filing.schema.json`.
 */
/** JSON Schema identifier for tooling. */
export const LAYER1_FILING_SCHEMA_ID = 'https://irving.local/schemas/layer1-filing.schema.json';
export const SCHEMA_ENUM_BLOCK_TYPE = [
    'structural',
    'pricing_mechanism',
    'constraint',
    'termination',
    'regulatory_disclosure',
];
/** User-facing label “disclosure” maps to `regulatory_disclosure` (see schema `description`). */
export const SCHEMA_ENUM_RELATIONSHIP_TYPE = [
    'defines',
    'constrains',
    'governs',
    'references',
    'triggers',
];
//# sourceMappingURL=filing-types.js.map