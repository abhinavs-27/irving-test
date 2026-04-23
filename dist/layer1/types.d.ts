/**
 * SEC Layer 1 schema v2 — queryable, normalized, invariant-driven.
 */
export declare const ATOMIC_KIND_VALUES: readonly ["structural", "pricing", "constraint", "termination", "disclosure"];
export type AtomicClauseKind = (typeof ATOMIC_KIND_VALUES)[number];
export declare const LAYER1_BLOCK_TYPES: readonly ["pricing_mechanism", "constraint", "structural", "termination", "regulatory_disclosure"];
export type Layer1BlockType = (typeof LAYER1_BLOCK_TYPES)[number];
export type UsdAmount = {
    value: number;
    currency: 'USD';
};
export type TimeWindowUnit = 'day' | 'month' | 'year';
export type TimeWindowV2 = {
    value: number;
    unit: TimeWindowUnit;
};
/** v2: structured dollar / threshold / durations only; no unclassified numbers. */
export type FactsV2 = {
    percentages: number[];
    dollar_amounts: UsdAmount[];
    share_counts: number[];
    price_thresholds: UsdAmount[];
    dates: string[];
    time_windows: TimeWindowV2[];
};
export type ClausePricingV2 = {
    method?: 'VWAP' | 'FIXED' | 'FORMULA';
    discount_rate?: number;
    valuation_window?: 'intraday' | 'full_session';
};
export type ClausePricingLayer1 = ClausePricingV2;
export declare const LEGAL_ROLE_VALUES: readonly ["issuer", "purchaser", "counterparty"];
export type LegalCounterpartyRole = (typeof LEGAL_ROLE_VALUES)[number];
export type Layer1ClauseSignals = {
    market_signals?: {
        exchange?: string;
    };
    security_signals?: {
        security_type?: string;
    };
    legal_signals?: {
        agreement_type?: string;
        /** @deprecated use counterparty_id in graph output; kept for pipeline compat */
        counterparty?: string;
        /** Stable id in entity_registry, e.g. org:b_riley_principal_capital_ii */
        counterparty_id?: string;
        counterparty_raw?: string;
        role?: LegalCounterpartyRole;
    };
};
export type SectionEntities = {
    organizations: string[];
    people: string[];
};
/** @deprecated alias */
export type SectionEntitiesV2 = SectionEntities;
/** Layer 1 graph edges (deterministic enum). */
export declare const KGRAPH_RELATIONSHIP_TYPES: readonly ["defines", "constrains", "governs", "references", "triggers"];
export type KgraphRelationshipType = (typeof KGRAPH_RELATIONSHIP_TYPES)[number];
export type DocumentRelationship = {
    type: KgraphRelationshipType;
    /** Block id (source is always a block). */
    source: string;
    /** Paragraph id, `org:…`, or `event:…` */
    target: string;
};
export declare const RELATIONSHIP_TYPES: readonly ["defines", "constrains", "governs", "references", "triggers"];
/** @deprecated v1 */
export declare const LEGACY_RELATIONSHIP_TYPES: readonly ["applies_to", "limits", "modifies"];
export declare const ENTITY_ID_PREFIX: "org:";
export declare const EVENT_ID_PREFIX: "event:";
export type EntityKind = 'organization' | 'person';
export type GraphEntityRecord = {
    kind: EntityKind;
    /** Primary display / normalized name. */
    canonical_name: string;
    /** Phrases that resolve to this id. */
    aliases: string[];
};
export type EntityRegistry = Record<string, GraphEntityRecord>;
/** Extracted from pricing blocks only; literals from the filing. */
export type VwapModeName = 'regular_purchase' | 'intraday_purchase';
export type VwapModeWindow = 'full_session' | 'intraday' | 'intraday_segments';
export type BlockPricingModelMode = {
    name: VwapModeName;
    vwap_window: VwapModeWindow;
    /** Only if stated as a % in the text. */
    discount_percent?: number;
    /** Only if explicitly stated. */
    volume_threshold_truncation?: boolean;
    excludes_open_close?: boolean;
    /** Only if text indicates multiple intraday segments. */
    multi_window?: boolean;
};
export type BlockPricingModel = {
    type: 'vwap_discount';
    /** Contract: explicit method when pricing is present. */
    method: 'VWAP';
    /** One entry per mode explicitly described (regular vs intraday) in the block. */
    modes: BlockPricingModelMode[];
};
export type ConstraintKind = 'exchange_issuance_cap' | 'beneficial_ownership_cap';
export type SectionConstraintEntry = {
    id: string;
    kind: ConstraintKind;
    source_paragraph_ids: string[];
    source_block_id: string;
    description: string;
    /** Normalized from facts (percent, USD, shares). */
    values?: {
        percentages?: number[];
        dollar_cap?: UsdAmount;
        share_cap?: number;
    };
};
export type GraphEventKind = 'agreement_execution' | 'agreement_termination' | 'commencement';
export type GraphEvent = {
    id: string;
    kind: GraphEventKind;
    /** Verbatim or minimal neutral label; no interpretation. */
    label: string;
    /** Issuer / registrant organization id. */
    primary_entity_id: string;
    /** All non-issuer organizations party to the event (>= 1 after normalize). */
    counterparty_entity_ids: string[];
    /** Agreement titles explicitly stated in the filing (order preserved). */
    agreement_types: string[];
    /** Blocks that materially source the event (>= 1). */
    source_block_ids: string[];
    /** ISO date if explicitly stated. */
    as_of_date?: string;
};
export declare const CONCEPT_ID_PREFIX: "concept:";
export declare const CORE_CONCEPT_IDS: readonly ["concept:intraday_purchase", "concept:regular_purchase", "concept:aggregate_ownership", "concept:exchange_cap_issuance", "concept:agreement_termination"];
export type GraphConceptType = 'abstract' | 'purchase_type' | 'ownership' | 'issuance' | 'termination';
export type GraphConceptRecord = {
    type: GraphConceptType;
    description: string;
    source_paragraphs: string[];
    /** Abstract parent, e.g. `concept:purchase` */
    parent?: string;
};
export type GraphMetadata = {
    version: '2.0' | '2.1';
    schema: 'sec_kg_v2' | 'sec_kg_v2_1';
};
export declare function isAtomicKind(v: unknown): v is AtomicClauseKind;
export declare function isLayer1BlockType(v: unknown): v is Layer1BlockType;
/** Maps each Layer 1 block to the paragraph `atomicKind` (v2). */
export declare function atomicKindForLayer1BlockType(t: Layer1BlockType): AtomicClauseKind;
export type Facts = FactsV2;
/** @deprecated */
export type ParagraphFacts = FactsV2;
//# sourceMappingURL=types.d.ts.map