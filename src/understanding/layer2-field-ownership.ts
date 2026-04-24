/**
 * Single-domain Layer 2 projection: one ExtractedFields key per clause_type,
 * allowlisted field keys per domain (no cross-domain leakage, no schema drift).
 */
import type {
  ClauseType,
  ClausePriority,
  ConstraintSchema,
  DisclosureSchema,
  ExchangeIssuanceConstraint,
  ExtractedFields,
  GenericConstraint,
  BeneficialOwnershipConstraint,
  PricingMode,
  PricingSchema,
  StructuralSchema,
  TerminationSchema,
} from './normalized-clause.js';
import { pruneEmptyExtractedFields } from './layer2-extracted-build.js';

/** Maps clause_type → the sole key allowed in `extracted_fields` (undefined → must be `{}`). */
export const DOMAIN_BY_CLAUSE_TYPE: Record<
  ClauseType,
  keyof ExtractedFields | undefined
> = {
  structural: 'structural',
  pricing_terms: 'pricing',
  constraint: 'constraints',
  termination: 'termination',
  disclosure: 'disclosure',
  obligation: 'obligations',
  indemnity: 'obligations',
  payment: 'obligations',
  other: undefined,
};

export const PRIORITY_BY_TYPE: Record<ClauseType, ClausePriority> = {
  structural: 'low',
  pricing_terms: 'high',
  constraint: 'high',
  termination: 'high',
  disclosure: 'medium',
  obligation: 'medium',
  indemnity: 'medium',
  payment: 'medium',
  other: 'low',
};

const STRUCTURAL_ALLOWED = new Set<keyof StructuralSchema>([
  'agreement_reference_date_iso',
  'execution_date_iso',
]);

const TERMINATION_ALLOWED = new Set<keyof TerminationSchema>([
  'stated_term_days',
  'stated_term_months',
  'termination_notice_days',
  'aggregate_purchase_ceiling_usd',
]);

const PRICING_MODE_ALLOWED = new Set<keyof PricingMode>([
  'purchase_mode',
  'vwap_session',
  'discount_rate',
  'volume_adjusted',
  'excludes_open_close',
  'multi_segment_intraday',
]);

const EXCHANGE_ROW_ALLOWED = new Set<keyof ExchangeIssuanceConstraint>([
  'share_cap',
  'issuance_cap_rate',
]);

const BENEFICIAL_ROW_ALLOWED = new Set<keyof BeneficialOwnershipConstraint>([
  'cap_rate',
]);

const GENERIC_ROW_ALLOWED = new Set<keyof GenericConstraint>([
  'kind',
  'numeric_value',
  'rate',
]);

function pickStructural(s: StructuralSchema): StructuralSchema {
  const o: StructuralSchema = {};
  for (const k of STRUCTURAL_ALLOWED) {
    const v = s[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o;
}

function pickTermination(t: TerminationSchema): TerminationSchema {
  const o: TerminationSchema = {};
  for (const k of TERMINATION_ALLOWED) {
    const v = t[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o;
}

function pickPricingMode(m: PricingMode): PricingMode {
  const o: Partial<PricingMode> = {};
  for (const k of PRICING_MODE_ALLOWED) {
    const v = m[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o as PricingMode;
}

function pickPricing(p: PricingSchema): PricingSchema {
  const o: PricingSchema = {
    mechanism: p.mechanism,
    settlement_method: p.settlement_method,
  };
  if (p.discount_rate !== undefined) o.discount_rate = p.discount_rate;
  if (p.modes !== undefined) o.modes = p.modes.map(pickPricingMode);
  return o;
}

function pickExchangeRow(r: ExchangeIssuanceConstraint): ExchangeIssuanceConstraint {
  const o: ExchangeIssuanceConstraint = {};
  for (const k of EXCHANGE_ROW_ALLOWED) {
    const v = r[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o;
}

function pickBeneficialRow(r: BeneficialOwnershipConstraint): BeneficialOwnershipConstraint {
  const o: BeneficialOwnershipConstraint = {};
  for (const k of BENEFICIAL_ROW_ALLOWED) {
    const v = r[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o;
}

function pickGenericRow(r: GenericConstraint): GenericConstraint {
  const o: GenericConstraint = { kind: r.kind };
  for (const k of GENERIC_ROW_ALLOWED) {
    if (k === 'kind') continue;
    const v = r[k];
    if (v !== undefined) (o as Record<string, unknown>)[k] = v;
  }
  return o;
}

function pickConstraints(c: ConstraintSchema): ConstraintSchema {
  const o: ConstraintSchema = {};
  if (c.exchange_issuance !== undefined) {
    const rows = c.exchange_issuance.map(pickExchangeRow).filter(
      (r) => Object.keys(r).length > 0,
    );
    if (rows.length > 0) o.exchange_issuance = rows;
  }
  if (c.beneficial_ownership !== undefined) {
    const rows = c.beneficial_ownership.map(pickBeneficialRow).filter(
      (r) => Object.keys(r).length > 0,
    );
    if (rows.length > 0) o.beneficial_ownership = rows;
  }
  if (c.other_constraints !== undefined) {
    const rows = c.other_constraints.map(pickGenericRow);
    if (rows.length > 0) o.other_constraints = rows;
  }
  return o;
}

function pickDisclosure(d: DisclosureSchema): DisclosureSchema {
  const o: DisclosureSchema = {};
  if (d.financial?.largest_amount_usd !== undefined) {
    o.financial = { largest_amount_usd: d.financial.largest_amount_usd };
  }
  if (d.issuance?.largest_share_count !== undefined) {
    o.issuance = { largest_share_count: d.issuance.largest_share_count };
  }
  return o;
}

/**
 * Keep only allowlisted keys for the payload under a domain key
 * (strips e.g. economic keys mistakenly present on structural).
 */
function enforceFieldOwnershipOnDomain(
  dom: keyof ExtractedFields,
  payload: NonNullable<ExtractedFields[typeof dom]>,
): NonNullable<ExtractedFields[typeof dom]> {
  switch (dom) {
    case 'structural':
      return pickStructural(payload as StructuralSchema) as NonNullable<
        ExtractedFields[typeof dom]
      >;
    case 'termination':
      return pickTermination(payload as TerminationSchema) as NonNullable<
        ExtractedFields[typeof dom]
      >;
    case 'pricing':
      return pickPricing(payload as PricingSchema) as NonNullable<
        ExtractedFields[typeof dom]
      >;
    case 'constraints':
      return pickConstraints(payload as ConstraintSchema) as NonNullable<
        ExtractedFields[typeof dom]
      >;
    case 'disclosure':
      return pickDisclosure(payload as DisclosureSchema) as NonNullable<
        ExtractedFields[typeof dom]
      >;
    case 'obligations': {
      return {} as NonNullable<ExtractedFields[typeof dom]>;
    }
    default: {
      const _e: never = dom;
      return _e;
    }
  }
}

/**
 * Retain a single domain per `clause_type`, allowlist keys, omit empty domain objects.
 */
export function applyStrictExtractedFields(
  ef: ExtractedFields,
  clause_type: ClauseType,
): ExtractedFields {
  const dom = DOMAIN_BY_CLAUSE_TYPE[clause_type];
  if (dom === undefined) {
    return {};
  }
  const raw = ef[dom];
  if (raw === undefined) {
    return {};
  }
  const cleaned = enforceFieldOwnershipOnDomain(dom, raw);
  if (
    typeof cleaned === 'object' &&
    cleaned !== null &&
    !Array.isArray(cleaned) &&
    Object.keys(cleaned as object).length === 0
  ) {
    return {};
  }
  const out: ExtractedFields = { [dom]: cleaned } as ExtractedFields;
  return pruneEmptyExtractedFields(out);
}
