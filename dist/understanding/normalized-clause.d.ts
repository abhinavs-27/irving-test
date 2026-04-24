/**
 * Layer 2 Semantic Schema v2 — strict ClauseBlock + ExtractedFields.
 * @see specs/understanding_contract.md
 */
export declare const NORMALIZED_CLAUSE_TYPES: readonly ["structural", "pricing_terms", "constraint", "termination", "disclosure", "obligation", "indemnity", "payment", "other"];
export type ClauseType = (typeof NORMALIZED_CLAUSE_TYPES)[number];
/** @deprecated alias — use {@link ClauseType} */
export type NormalizedClauseType = ClauseType;
export type Layer2RelationshipSlice = {
    governs: string[];
    constrains: string[];
    references: string[];
};
export type ClausePriority = 'low' | 'medium' | 'high';
export type PricingMechanism = 'vwap_discount' | 'fixed_price' | 'other';
export type PricingSchema = {
    mechanism: PricingMechanism;
    settlement_method: string;
    discount_rate?: number;
    modes?: PricingMode[];
};
export type PricingMode = {
    purchase_mode: string;
    vwap_session: string;
    discount_rate?: number;
    volume_adjusted?: boolean;
    excludes_open_close?: boolean;
    multi_segment_intraday?: boolean;
};
export type ExchangeIssuanceConstraint = {
    share_cap?: number;
    issuance_cap_rate?: number;
};
export type BeneficialOwnershipConstraint = {
    cap_rate?: number;
};
export type GenericConstraint = {
    kind: string;
    numeric_value?: number;
    rate?: number;
};
export type ConstraintSchema = {
    exchange_issuance?: ExchangeIssuanceConstraint[];
    beneficial_ownership?: BeneficialOwnershipConstraint[];
    other_constraints?: GenericConstraint[];
};
/** Flat only — no nesting (v2). */
export type TerminationSchema = {
    stated_term_days?: number;
    stated_term_months?: number;
    termination_notice_days?: number;
    aggregate_purchase_ceiling_usd?: number;
};
/** Dates only — economic signals belong in {@link TerminationSchema} (and other governing domains). */
export type StructuralSchema = {
    agreement_reference_date_iso?: string;
    execution_date_iso?: string;
};
export type DisclosureSchema = {
    financial?: {
        largest_amount_usd?: number;
    };
    issuance?: {
        largest_share_count?: number;
    };
};
export type ObligationSchema = Record<string, never>;
export type ExtractedFields = {
    pricing?: PricingSchema;
    constraints?: ConstraintSchema;
    termination?: TerminationSchema;
    disclosure?: DisclosureSchema;
    structural?: StructuralSchema;
    obligations?: ObligationSchema;
};
/** @deprecated alias — use {@link ExtractedFields} */
export type Layer2ExtractedFields = ExtractedFields;
export type ClauseBlock = {
    clause_id: string;
    clause_type: ClauseType;
    source_block_id: string;
    source_paragraph_ids: string[];
    primary_entity_id: string;
    counterparty_entity_ids: string[];
    event_ids: string[];
    event_kinds: string[];
    relationships: Layer2RelationshipSlice;
    extracted_fields: ExtractedFields;
    confidence: number;
    priority: ClausePriority;
};
/** @deprecated alias — use {@link ClauseBlock} */
export type NormalizedClauseRecord = ClauseBlock;
/** @deprecated — v2 uses `PricingSchema.settlement_method: string` */
export type SettlementMethod = 'VWAP' | 'FIXED' | 'UNKNOWN';
//# sourceMappingURL=normalized-clause.d.ts.map