import type {
  BeneficialOwnershipConstraint,
  ClauseBlock,
  ClauseType,
  ConstraintSchema,
  DisclosureSchema,
  ExchangeIssuanceConstraint,
  ExtractedFields,
  GenericConstraint,
  PricingMode,
  PricingSchema,
  StructuralSchema,
  TerminationSchema,
} from './normalized-clause.js';
import { NORMALIZED_CLAUSE_TYPES } from './normalized-clause.js';

const TERMINATION_KEYS = new Set<keyof TerminationSchema>([
  'stated_term_days',
  'stated_term_months',
  'termination_notice_days',
  'aggregate_purchase_ceiling_usd',
]);

const PRICING_KEYS = new Set<keyof PricingSchema>([
  'mechanism',
  'settlement_method',
  'discount_rate',
  'modes',
]);

const PRICING_MODE_KEYS = new Set<keyof PricingMode>([
  'purchase_mode',
  'vwap_session',
  'discount_rate',
  'volume_adjusted',
  'excludes_open_close',
  'multi_segment_intraday',
]);

const EXCHANGE_ROW_KEYS = new Set<keyof ExchangeIssuanceConstraint>([
  'share_cap',
  'issuance_cap_rate',
]);

const BENEFICIAL_ROW_KEYS = new Set<keyof BeneficialOwnershipConstraint>([
  'cap_rate',
]);

const GENERIC_ROW_KEYS = new Set<keyof GenericConstraint>([
  'kind',
  'numeric_value',
  'rate',
]);

const STRUCTURAL_KEYS = new Set<keyof StructuralSchema>([
  'agreement_reference_date_iso',
  'execution_date_iso',
]);

const EXTRACTED_TOP = new Set<keyof ExtractedFields>([
  'pricing',
  'constraints',
  'termination',
  'disclosure',
  'structural',
  'obligations',
]);

const CLAUSE_TYPES = new Set<string>(NORMALIZED_CLAUSE_TYPES);

function assert(cond: unknown, msg: string, path: string): asserts cond {
  if (!cond) throw new Error(`Layer2 schema: ${path}: ${msg}`);
}

function assertNoUnknownKeys(
  obj: object,
  allowed: Set<string>,
  path: string,
): void {
  for (const k of Object.keys(obj)) {
    assert(allowed.has(k), `unknown key "${k}"`, path);
  }
}

function assertRate01(x: number | undefined, path: string): void {
  if (x === undefined) return;
  assert(
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1,
    `rate must be in [0,1], got ${String(x)}`,
    path,
  );
}

function assertUsdNumber(x: unknown, path: string): void {
  assert(
    typeof x === 'number' && Number.isFinite(x),
    `USD field must be a finite number, not an object or string`,
    path,
  );
}

function validateTerminationFlat(t: TerminationSchema, path: string): void {
  assertNoUnknownKeys(t, TERMINATION_KEYS as Set<string>, path);
  for (const [k, v] of Object.entries(t)) {
    if (v === undefined) continue;
    assert(
      typeof v === 'number' && Number.isFinite(v),
      `termination field "${k}" must be a finite number (flat schema)`,
      `${path}/${k}`,
    );
  }
}

function validatePricingSchema(p: PricingSchema, path: string): void {
  assertNoUnknownKeys(p, PRICING_KEYS as Set<string>, path);
  assertRate01(p.discount_rate, `${path}/discount_rate`);
  for (let i = 0; i < (p.modes?.length ?? 0); i += 1) {
    const m = p.modes![i]!;
    const mp = `${path}/modes/${i}`;
    assertNoUnknownKeys(m, PRICING_MODE_KEYS as Set<string>, mp);
    assertRate01(m.discount_rate, `${mp}/discount_rate`);
  }
}

function validateConstraintSchema(c: ConstraintSchema, path: string): void {
  const allowed = new Set(['exchange_issuance', 'beneficial_ownership', 'other_constraints']);
  assertNoUnknownKeys(c, allowed, path);
  let i = 0;
  for (const row of c.exchange_issuance ?? []) {
    const rp = `${path}/exchange_issuance/${i}`;
    assertNoUnknownKeys(row, EXCHANGE_ROW_KEYS as Set<string>, rp);
    const hasEcon =
      row.share_cap !== undefined || row.issuance_cap_rate !== undefined;
    assert(
      hasEcon,
      'exchange_issuance row must have share_cap and/or issuance_cap_rate',
      rp,
    );
    assertRate01(row.issuance_cap_rate, `${rp}/issuance_cap_rate`);
    i += 1;
  }
  i = 0;
  for (const row of c.beneficial_ownership ?? []) {
    const rp = `${path}/beneficial_ownership/${i}`;
    assertNoUnknownKeys(row, BENEFICIAL_ROW_KEYS as Set<string>, rp);
    assert(row.cap_rate !== undefined, 'beneficial_ownership row must have cap_rate', rp);
    assertRate01(row.cap_rate, `${rp}/cap_rate`);
    i += 1;
  }
  i = 0;
  for (const row of c.other_constraints ?? []) {
    const rp = `${path}/other_constraints/${i}`;
    assertNoUnknownKeys(row, GENERIC_ROW_KEYS as Set<string>, rp);
    assertRate01(row.rate, `${rp}/rate`);
    if (row.numeric_value !== undefined) {
      assertUsdNumber(row.numeric_value, `${rp}/numeric_value`);
    }
    i += 1;
  }
}

function validateStructuralSchema(s: StructuralSchema, path: string): void {
  assertNoUnknownKeys(s, STRUCTURAL_KEYS as Set<string>, path);
}

function validateDisclosureSchema(d: DisclosureSchema, path: string): void {
  assertNoUnknownKeys(d, new Set(['financial', 'issuance']), path);
  if (d.financial !== undefined) {
    assertNoUnknownKeys(d.financial, new Set(['largest_amount_usd']), `${path}/financial`);
    if (d.financial.largest_amount_usd !== undefined) {
      assertUsdNumber(d.financial.largest_amount_usd, `${path}/financial/largest_amount_usd`);
    }
  }
  if (d.issuance !== undefined) {
    assertNoUnknownKeys(d.issuance, new Set(['largest_share_count']), `${path}/issuance`);
    if (d.issuance.largest_share_count !== undefined) {
      assert(
        typeof d.issuance.largest_share_count === 'number' &&
          Number.isFinite(d.issuance.largest_share_count),
        `issuance.largest_share_count must be a finite number`,
        `${path}/issuance/largest_share_count`,
      );
    }
  }
}

/** Domains that must appear (non-undefined) for this clause_type. */
function domainsRequired(ct: ClauseType): (keyof ExtractedFields)[] {
  switch (ct) {
    case 'pricing_terms':
      return ['pricing'];
    default:
      return [];
  }
}

/** Domains allowed for this clause_type (subset of ExtractedFields keys). */
function domainsAllowed(ct: ClauseType): Set<keyof ExtractedFields> {
  switch (ct) {
    case 'pricing_terms':
      return new Set(['pricing']);
    case 'constraint':
      return new Set(['constraints']);
    case 'termination':
      return new Set(['termination']);
    case 'disclosure':
      return new Set(['disclosure']);
    case 'structural':
      return new Set(['structural']);
    case 'obligation':
    case 'indemnity':
    case 'payment':
    case 'other':
      return new Set();
    default: {
      const _e: never = ct;
      return _e;
    }
  }
}

function validateExtractedFieldsShape(
  clause_type: ClauseType,
  ef: ExtractedFields,
  path: string,
): void {
  assertNoUnknownKeys(ef, EXTRACTED_TOP as Set<string>, path);

  const allowed = domainsAllowed(clause_type);
  for (const k of Object.keys(ef) as (keyof ExtractedFields)[]) {
    if (ef[k] === undefined) continue;
    assert(
      allowed.has(k),
      `domain "${String(k)}" is not allowed for clause_type "${clause_type}"`,
      `${path}/${String(k)}`,
    );
  }

  for (const req of domainsRequired(clause_type)) {
    assert(
      ef[req] !== undefined,
      `clause_type "${clause_type}" requires extracted_fields.${String(req)}`,
      path,
    );
  }

  if (ef.pricing) validatePricingSchema(ef.pricing, `${path}/pricing`);
  if (ef.constraints) validateConstraintSchema(ef.constraints, `${path}/constraints`);
  if (ef.termination) validateTerminationFlat(ef.termination, `${path}/termination`);
  if (ef.structural) validateStructuralSchema(ef.structural, `${path}/structural`);
  if (ef.disclosure) validateDisclosureSchema(ef.disclosure, `${path}/disclosure`);
  if (ef.obligations !== undefined) {
    assertNoUnknownKeys(ef.obligations, new Set(), `${path}/obligations`);
  }
}

/**
 * Hard validation for Layer 2 v2 projection output. Throws on first violation batch (single Error).
 */
export function assertLayer2ClauseBlock(record: ClauseBlock): void {
  const base = `clause/${record.clause_id}`;
  assert(record.extracted_fields != null, 'extracted_fields is required', base);
  assert(
    typeof record.extracted_fields === 'object' && !Array.isArray(record.extracted_fields),
    'extracted_fields must be an object',
    base,
  );
  assert(CLAUSE_TYPES.has(record.clause_type), 'invalid clause_type', base);

  validateExtractedFieldsShape(
    record.clause_type,
    record.extracted_fields,
    `${base}/extracted_fields`,
  );
}

const TERMINATION_FIELD_KEYS: (keyof TerminationSchema)[] = [
  'stated_term_days',
  'stated_term_months',
  'termination_notice_days',
  'aggregate_purchase_ceiling_usd',
];

/**
 * Filing-level: termination domain only on termination clauses; each termination field
 * owned by at most one clause (canonical merge must run before this).
 */
export function assertLayer2FilingCanonicalOwnership(records: readonly ClauseBlock[]): void {
  const owners = new Map<string, string>();

  for (const c of records) {
    const t = c.extracted_fields.termination;
    if (!t) continue;

    assert(
      c.clause_type === 'termination',
      `termination fields must only appear on clause_type "termination" (found on ${c.clause_type})`,
      `clause/${c.clause_id}/extracted_fields/termination`,
    );

    for (const k of TERMINATION_FIELD_KEYS) {
      const v = t[k];
      if (v === undefined) continue;
      const key = `${String(k)}:${String(v)}`;
      const prev = owners.get(key);
      assert(
        prev === undefined,
        `duplicate termination field ownership: ${String(k)}=${String(v)} on "${prev}" and "${c.clause_id}"`,
        `filing/termination/${String(k)}`,
      );
      owners.set(key, c.clause_id);
    }
  }
}

export function assertLayer2ClauseBlocks(records: readonly ClauseBlock[]): void {
  for (const r of records) assertLayer2ClauseBlock(r);
  assertLayer2FilingCanonicalOwnership(records);
}
