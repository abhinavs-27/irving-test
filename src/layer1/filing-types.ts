/**
 * Strict TypeScript types for the persisted Layer 1 filing document
 * (`entity_registry`, `block_registry`, `events`, `relationships`, `sections`).
 * Aligns with `schemas/layer1-filing.schema.json`.
 */

import type { BlockRegistryEntry } from './block-registry.js';
import type {
  DocumentRelationship,
  EntityRegistry,
  FactsV2,
  GraphEvent,
  Layer1ClauseSignals,
  SectionConstraintEntry,
  SectionEntities,
  ClausePricingLayer1,
} from './types.js';

/** Root document produced by `analyze.ts` / compatible emitters. */
export type Layer1Filing = {
  entity_registry: EntityRegistry;
  block_registry: Record<string, BlockRegistryEntry>;
  events: GraphEvent[];
  relationships: DocumentRelationship[];
  /** Rich tree; shape preserved for downstream layers. */
  sections?: FilingSectionNode[];
};

/**
 * Recursive section / paragraph tree (JSON-serialized clauses).
 * Optional fields mirror `Clause` without importing heavy clause types in consumers.
 */
export type FilingSectionNode = {
  id: string;
  type: string;
  title?: string;
  text?: string;
  filingHeader?: unknown;
  atomicKind?: string;
  pricing?: ClausePricingLayer1;
  facts?: FactsV2;
  signals?: Layer1ClauseSignals;
  entities?: SectionEntities;
  block_ids?: string[];
  constraints?: SectionConstraintEntry[];
  children?: FilingSectionNode[];
};

/** JSON Schema identifier for tooling. */
export const LAYER1_FILING_SCHEMA_ID =
  'https://irving.local/schemas/layer1-filing.schema.json' as const;

export const SCHEMA_ENUM_BLOCK_TYPE = [
  'structural',
  'pricing_mechanism',
  'constraint',
  'termination',
  'regulatory_disclosure',
] as const;

/** User-facing label “disclosure” maps to `regulatory_disclosure` (see schema `description`). */
export const SCHEMA_ENUM_RELATIONSHIP_TYPE = [
  'defines',
  'constrains',
  'governs',
  'references',
  'triggers',
] as const;
