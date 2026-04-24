import type {
  BeneficialOwnershipConstraint,
  ClauseBlock,
  ConstraintSchema,
  DisclosureSchema,
  ExchangeIssuanceConstraint,
  ExtractedFields,
  GenericConstraint,
  Layer2RelationshipSlice,
  PricingMode,
  PricingSchema,
  StructuralSchema,
  TerminationSchema,
} from './normalized-clause.js';
import { applyStrictExtractedFields, PRIORITY_BY_TYPE } from './layer2-field-ownership.js';

/** Canonical top-level key order for ClauseBlock JSON (v2 production). */
export const LAYER2_CLAUSE_BLOCK_JSON_KEYS = [
  'clause_id',
  'clause_type',
  'source_block_id',
  'source_paragraph_ids',
  'primary_entity_id',
  'counterparty_entity_ids',
  'event_ids',
  'event_kinds',
  'relationships',
  'extracted_fields',
  'confidence',
  'priority',
] as const satisfies readonly (keyof ClauseBlock)[];

function sortStrings(a: readonly string[]): string[] {
  return [...a].sort((x, y) => x.localeCompare(y));
}

function orderStructural(s: StructuralSchema): StructuralSchema {
  const o: StructuralSchema = {};
  if (s.agreement_reference_date_iso !== undefined) {
    o.agreement_reference_date_iso = s.agreement_reference_date_iso;
  }
  if (s.execution_date_iso !== undefined) {
    o.execution_date_iso = s.execution_date_iso;
  }
  return o;
}

function orderTermination(t: TerminationSchema): TerminationSchema {
  const o: TerminationSchema = {};
  if (t.stated_term_days !== undefined) o.stated_term_days = t.stated_term_days;
  if (t.stated_term_months !== undefined) o.stated_term_months = t.stated_term_months;
  if (t.termination_notice_days !== undefined) {
    o.termination_notice_days = t.termination_notice_days;
  }
  if (t.aggregate_purchase_ceiling_usd !== undefined) {
    o.aggregate_purchase_ceiling_usd = t.aggregate_purchase_ceiling_usd;
  }
  return o;
}

function orderPricingMode(m: PricingMode): PricingMode {
  const o: PricingMode = {
    purchase_mode: m.purchase_mode,
    vwap_session: m.vwap_session,
  };
  if (m.discount_rate !== undefined) o.discount_rate = m.discount_rate;
  if (m.volume_adjusted !== undefined) o.volume_adjusted = m.volume_adjusted;
  if (m.excludes_open_close !== undefined) o.excludes_open_close = m.excludes_open_close;
  if (m.multi_segment_intraday !== undefined) {
    o.multi_segment_intraday = m.multi_segment_intraday;
  }
  return o;
}

function orderPricing(p: PricingSchema): PricingSchema {
  const o: PricingSchema = {
    mechanism: p.mechanism,
    settlement_method: p.settlement_method,
  };
  if (p.discount_rate !== undefined) o.discount_rate = p.discount_rate;
  if (p.modes !== undefined) o.modes = p.modes.map(orderPricingMode);
  return o;
}

function orderExchangeRow(r: ExchangeIssuanceConstraint): ExchangeIssuanceConstraint {
  const o: ExchangeIssuanceConstraint = {};
  if (r.share_cap !== undefined) o.share_cap = r.share_cap;
  if (r.issuance_cap_rate !== undefined) o.issuance_cap_rate = r.issuance_cap_rate;
  return o;
}

function orderBeneficialRow(r: BeneficialOwnershipConstraint): BeneficialOwnershipConstraint {
  const o: BeneficialOwnershipConstraint = {};
  if (r.cap_rate !== undefined) o.cap_rate = r.cap_rate;
  return o;
}

function orderGenericRow(r: GenericConstraint): GenericConstraint {
  const o: GenericConstraint = { kind: r.kind };
  if (r.numeric_value !== undefined) o.numeric_value = r.numeric_value;
  if (r.rate !== undefined) o.rate = r.rate;
  return o;
}

function orderConstraints(c: ConstraintSchema): ConstraintSchema {
  const o: ConstraintSchema = {};
  if (c.exchange_issuance !== undefined) {
    o.exchange_issuance = c.exchange_issuance.map(orderExchangeRow);
  }
  if (c.beneficial_ownership !== undefined) {
    o.beneficial_ownership = c.beneficial_ownership.map(orderBeneficialRow);
  }
  if (c.other_constraints !== undefined) {
    o.other_constraints = c.other_constraints.map(orderGenericRow);
  }
  return o;
}

function orderDisclosure(d: DisclosureSchema): DisclosureSchema {
  const o: DisclosureSchema = {};
  if (d.financial !== undefined) {
    o.financial = { largest_amount_usd: d.financial.largest_amount_usd };
  }
  if (d.issuance !== undefined) {
    o.issuance = { largest_share_count: d.issuance.largest_share_count };
  }
  return o;
}

function orderExtractedFields(ef: ExtractedFields): ExtractedFields {
  const o: ExtractedFields = {};
  if (ef.pricing !== undefined) o.pricing = orderPricing(ef.pricing);
  if (ef.constraints !== undefined) o.constraints = orderConstraints(ef.constraints);
  if (ef.termination !== undefined) o.termination = orderTermination(ef.termination);
  if (ef.disclosure !== undefined) o.disclosure = orderDisclosure(ef.disclosure);
  if (ef.structural !== undefined) o.structural = orderStructural(ef.structural);
  if (ef.obligations !== undefined) o.obligations = { ...ef.obligations };
  return o;
}

function orderRelationships(r: Layer2RelationshipSlice): Layer2RelationshipSlice {
  return {
    governs: sortStrings(r.governs),
    constrains: sortStrings(r.constrains),
    references: sortStrings(r.references),
  };
}

/**
 * Returns a new {@link ClauseBlock} with canonical key order and sorted string arrays
 * for diff-stable JSON serialization.
 */
export function normalizeClauseBlockOrder(block: ClauseBlock): ClauseBlock {
  const ordered: Record<string, unknown> = {};
  const next: ClauseBlock = {
    clause_id: block.clause_id,
    clause_type: block.clause_type,
    source_block_id: block.source_block_id,
    source_paragraph_ids: sortStrings(block.source_paragraph_ids),
    primary_entity_id: block.primary_entity_id,
    counterparty_entity_ids: sortStrings(block.counterparty_entity_ids),
    event_ids: sortStrings(block.event_ids),
    event_kinds: sortStrings(block.event_kinds),
    relationships: orderRelationships(block.relationships),
    extracted_fields: orderExtractedFields(block.extracted_fields),
    confidence: block.confidence,
    priority: block.priority,
  };
  for (const k of LAYER2_CLAUSE_BLOCK_JSON_KEYS) {
    ordered[k] = next[k];
  }
  return ordered as ClauseBlock;
}

/**
 * Single-domain `extracted_fields`, allowlisted keys, and deterministic
 * `priority` from `clause_type`; then canonical key order (use before validation / JSON write).
 */
export function prepareLayer2ClauseForExport(block: ClauseBlock): ClauseBlock {
  return normalizeClauseBlockOrder({
    ...block,
    extracted_fields: applyStrictExtractedFields(
      block.extracted_fields,
      block.clause_type,
    ),
    priority: PRIORITY_BY_TYPE[block.clause_type],
  });
}

export function prepareLayer2ClausesForExport(blocks: readonly ClauseBlock[]): ClauseBlock[] {
  return blocks.map((b) => prepareLayer2ClauseForExport(b));
}

/** Stable JSON for Layer 2 clause arrays (2-space indent). */
export function stringifyLayer2ClausesStable(clauses: readonly ClauseBlock[]): string {
  return `${JSON.stringify(prepareLayer2ClausesForExport([...clauses]), null, 2)}\n`;
}
