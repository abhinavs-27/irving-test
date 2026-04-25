/**
 * Layer 3 — synthesize `Agreement` views from Layer 2 `ClauseBlock` truth.
 * @see specs/understanding_contract.md
 */
import { createHash } from 'node:crypto';

import type {
  ClauseBlock,
  ClauseType,
  PricingMechanism,
  TerminationSchema,
} from './normalized-clause.js';

// --- Types -----------------------------------------------------------------

export type AgreementConflict = {
  domain: 'pricing' | 'constraints' | 'termination' | 'disclosure' | 'agreement';
  message: string;
};

export type AgreementTerms = {
  agreement_reference_date_iso?: string;
  execution_date_iso?: string;
};

export type AgreementPricing = {
  mechanism: PricingMechanism;
  settlement_method: string;
  discount_rate?: number;
  has_variable_pricing: boolean;
};

export type AgreementConstraints = {
  /** Tightest (minimum) cap rate across exchange rows. */
  exchange_issuance_cap_rate?: number;
  /** Tightest (minimum) beneficial cap rate. */
  beneficial_ownership_cap_rate?: number;
};

export type AgreementTermination = {
  stated_term_days?: number;
  stated_term_months?: number;
  termination_notice_days?: number;
  aggregate_purchase_ceiling_usd?: number;
};

export type AgreementDisclosure = {
  financial_largest_amount_usd?: number;
  issuance_largest_share_count?: number;
};

export type RiskFlag = {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  /** clause_ids that triggered this flag — empty when not traceable. */
  clause_ids: string[];
};

export type AgreementMetadata = {
  clause_count: number;
  high_priority_clause_count: number;
  /** Mean confidence across member clauses. */
  confidence: number;
  conflicts: AgreementConflict[];
};

export type Agreement = {
  agreement_id: string;
  primary_entity_id: string;
  counterparty_entity_ids: string[];

  clause_ids: string[];

  agreement: AgreementTerms;
  pricing: AgreementPricing | undefined;
  constraints: AgreementConstraints | undefined;
  termination: AgreementTermination | undefined;
  disclosure: AgreementDisclosure | undefined;

  risk_flags: RiskFlag[];
  metadata: AgreementMetadata;
};

// --- Grouping & id ----------------------------------------------------------

function groupByKey<TItem>(items: TItem[], key: (t: TItem) => string): TItem[][] {
  const m = new Map<string, TItem[]>();
  for (const item of items) {
    const k = key(item);
    const arr = m.get(k);
    if (arr) arr.push(item);
    else m.set(k, [item]);
  }
  return [...m.keys()].sort((a, b) => a.localeCompare(b)).map((k) => m.get(k)!);
}

/**
 * One agreement group per (issuer, sorted counterparties) pair, matching Layer 2 scoping.
 */
export function groupByAgreement(clauses: readonly ClauseBlock[]): ClauseBlock[][] {
  return groupByKey([...clauses], (c) => {
    const cps = [...c.counterparty_entity_ids].sort((a, b) => a.localeCompare(b));
    return `${c.primary_entity_id}::${cps.join(',')}`;
  });
}

/**
 * Stable agreement ID derived from clause identities (not from mutable fields like confidence).
 * Changing confidence or extracted_fields on the same clauses does not alter this ID.
 */
export function generateAgreementId(clauses: readonly ClauseBlock[]): string {
  const sorted = [...clauses].sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  const payload = sorted
    .map(
      (c) =>
        `${c.clause_id}\t${c.clause_type}\t${c.primary_entity_id}\t${[...c.counterparty_entity_ids].sort().join(',')}`,
    )
    .join('\n');
  const h = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `agrm_${h.slice(0, 16)}`;
}

function uniqueSortedCounterparties(clauses: readonly ClauseBlock[]): string[] {
  const s = new Set<string>();
  for (const c of clauses) {
    for (const x of c.counterparty_entity_ids) s.add(x);
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

function averageConfidence(clauses: readonly ClauseBlock[]): number {
  if (clauses.length === 0) return 0;
  const t = clauses.reduce((a, c) => a + c.confidence, 0);
  return Math.round((t / clauses.length) * 1000) / 1000;
}

function countHighPriority(clauses: readonly ClauseBlock[]): number {
  return clauses.filter((c) => c.priority === 'high').length;
}

function clauseIdsByType(clauses: readonly ClauseBlock[], types: ClauseType[]): string[] {
  return clauses.filter((c) => types.includes(c.clause_type)).map((c) => c.clause_id);
}

// --- Extractors -------------------------------------------------------------

function extractAgreementTerms(clauses: readonly ClauseBlock[]): {
  value: AgreementTerms;
  conflicts: AgreementConflict[];
} {
  const conflicts: AgreementConflict[] = [];
  const structurals = clauses
    .filter((c) => c.clause_type === 'structural' && c.extracted_fields.structural)
    .sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  if (structurals.length === 0) {
    return { value: {}, conflicts };
  }
  const refs: string[] = [];
  const execs: string[] = [];
  for (const c of structurals) {
    const s = c.extracted_fields.structural!;
    if (s.agreement_reference_date_iso?.trim())
      refs.push(s.agreement_reference_date_iso.trim());
    if (s.execution_date_iso?.trim()) execs.push(s.execution_date_iso.trim());
  }
  if (new Set(refs).size > 1) {
    conflicts.push({
      domain: 'agreement',
      message: `Conflicting agreement_reference_date_iso: ${[...new Set(refs)].sort().join(' vs ')}`,
    });
  }
  if (new Set(execs).size > 1) {
    conflicts.push({
      domain: 'agreement',
      message: `Conflicting execution_date_iso: ${[...new Set(execs)].sort().join(' vs ')}`,
    });
  }
  return {
    value: {
      // ISO 8601 dates sort lexicographically = chronologically — earliest first is [0]
      ...(refs.length
        ? { agreement_reference_date_iso: refs.sort((a, b) => a.localeCompare(b))[0] }
        : {}),
      ...(execs.length
        ? { execution_date_iso: execs.sort((a, b) => a.localeCompare(b))[0] }
        : {}),
    },
    conflicts,
  };
}

function detectVariablePricing(clauses: readonly ClauseBlock[]): boolean {
  let modeCount = 0;
  const modeKeys = new Set<string>();
  for (const c of clauses) {
    const p = c.extracted_fields.pricing;
    if (!p?.modes) continue;
    for (const m of p.modes) {
      modeCount += 1;
      modeKeys.add(`${m.purchase_mode}::${m.vwap_session}`);
    }
  }
  return modeCount > 1 || modeKeys.size > 1;
}

function extractPricing(
  clauses: readonly ClauseBlock[],
): { value: AgreementPricing | undefined; conflicts: AgreementConflict[] } {
  const pricingClauses = clauses
    .filter((c) => c.clause_type === 'pricing_terms' && c.extracted_fields.pricing)
    .sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  const conflicts: AgreementConflict[] = [];
  if (pricingClauses.length === 0) {
    return { value: undefined, conflicts };
  }

  const mechs = new Set(pricingClauses.map((c) => c.extracted_fields.pricing!.mechanism));
  if (mechs.size > 1) {
    conflicts.push({
      domain: 'pricing',
      message: `Conflicting pricing.mechanism: ${[...mechs].sort().join(', ')}`,
    });
  }
  const settlements = new Set(
    pricingClauses.map((c) => c.extracted_fields.pricing!.settlement_method),
  );
  if (settlements.size > 1) {
    conflicts.push({
      domain: 'pricing',
      message: `Conflicting settlement_method: ${[...settlements].sort().join(', ')}`,
    });
  }

  const rateCandidates: number[] = [];
  for (const c of pricingClauses) {
    const p = c.extracted_fields.pricing!;
    if (p.discount_rate !== undefined) rateCandidates.push(p.discount_rate);
    for (const m of p.modes ?? []) {
      if (m.discount_rate !== undefined) rateCandidates.push(m.discount_rate);
    }
  }

  const p0 = pricingClauses[0]!.extracted_fields.pricing!;
  const has_variable_pricing =
    detectVariablePricing(pricingClauses) || pricingClauses.length > 1;

  return {
    value: {
      mechanism: p0.mechanism,
      settlement_method: p0.settlement_method,
      // max = worst-case discount (highest dilution exposure)
      ...(rateCandidates.length > 0
        ? { discount_rate: Math.max(...rateCandidates) }
        : {}),
      has_variable_pricing,
    },
    conflicts,
  };
}

function extractConstraints(
  clauses: readonly ClauseBlock[],
): { value: AgreementConstraints | undefined; conflicts: AgreementConflict[] } {
  const cons = clauses
    .filter((c) => c.clause_type === 'constraint' && c.extracted_fields.constraints)
    .sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  const conflicts: AgreementConflict[] = [];
  if (cons.length === 0) {
    return { value: undefined, conflicts };
  }
  const exRates: number[] = [];
  const benRates: number[] = [];
  for (const c of cons) {
    const ch = c.extracted_fields.constraints!;
    for (const r of ch.exchange_issuance ?? []) {
      if (r.issuance_cap_rate !== undefined) exRates.push(r.issuance_cap_rate);
    }
    for (const r of ch.beneficial_ownership ?? []) {
      if (r.cap_rate !== undefined) benRates.push(r.cap_rate);
    }
  }
  if (exRates.length === 0 && benRates.length === 0) {
    return { value: undefined, conflicts };
  }
  return {
    value: {
      // min = most restrictive cap (tightest protection)
      ...(exRates.length
        ? { exchange_issuance_cap_rate: Math.min(...exRates) }
        : {}),
      ...(benRates.length
        ? { beneficial_ownership_cap_rate: Math.min(...benRates) }
        : {}),
    },
    conflicts,
  };
}

function extractTermination(
  clauses: readonly ClauseBlock[],
): { value: AgreementTermination | undefined; conflicts: AgreementConflict[] } {
  const withTerm = clauses
    .filter(
      (c) =>
        c.clause_type === 'termination' &&
        c.extracted_fields.termination &&
        Object.keys(c.extracted_fields.termination).length > 0,
    )
    .sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  const conflicts: AgreementConflict[] = [];
  if (withTerm.length === 0) {
    return { value: undefined, conflicts };
  }

  const acc: TerminationSchema = {};
  for (const c of withTerm) {
    const t = c.extracted_fields.termination!;
    if (t.aggregate_purchase_ceiling_usd !== undefined) {
      acc.aggregate_purchase_ceiling_usd =
        acc.aggregate_purchase_ceiling_usd === undefined
          ? t.aggregate_purchase_ceiling_usd
          : Math.max(acc.aggregate_purchase_ceiling_usd, t.aggregate_purchase_ceiling_usd);
    }
    if (t.stated_term_months !== undefined) {
      acc.stated_term_months =
        acc.stated_term_months === undefined
          ? t.stated_term_months
          : Math.max(acc.stated_term_months, t.stated_term_months);
    }
    if (t.stated_term_days !== undefined) {
      acc.stated_term_days =
        acc.stated_term_days === undefined
          ? t.stated_term_days
          : Math.max(acc.stated_term_days, t.stated_term_days);
    }
    if (t.termination_notice_days !== undefined) {
      // min = shortest (tightest) notice requirement — worst case for the issuer
      acc.termination_notice_days =
        acc.termination_notice_days === undefined
          ? t.termination_notice_days
          : Math.min(acc.termination_notice_days, t.termination_notice_days);
    }
  }
  return {
    value: Object.keys(acc).length > 0 ? (acc as AgreementTermination) : undefined,
    conflicts,
  };
}

function extractDisclosure(
  clauses: readonly ClauseBlock[],
): { value: AgreementDisclosure | undefined; conflicts: AgreementConflict[] } {
  const discs = clauses
    .filter((c) => c.clause_type === 'disclosure' && c.extracted_fields.disclosure)
    .sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  const conflicts: AgreementConflict[] = [];
  if (discs.length === 0) {
    return { value: undefined, conflicts };
  }
  let maxUsd: number | undefined;
  let maxShares: number | undefined;
  for (const c of discs) {
    const d = c.extracted_fields.disclosure!;
    const u = d.financial?.largest_amount_usd;
    if (u !== undefined) {
      maxUsd = maxUsd === undefined ? u : Math.max(maxUsd, u);
    }
    const s = d.issuance?.largest_share_count;
    if (s !== undefined) {
      maxShares = maxShares === undefined ? s : Math.max(maxShares, s);
    }
  }
  const value: AgreementDisclosure = {
    ...(maxUsd !== undefined ? { financial_largest_amount_usd: maxUsd } : {}),
    ...(maxShares !== undefined ? { issuance_largest_share_count: maxShares } : {}),
  };
  if (Object.keys(value).length === 0) {
    return { value: undefined, conflicts };
  }
  return { value, conflicts };
}

// --- Risk ------------------------------------------------------------------

/**
 * Compute risk flags for an agreement.
 * Pass the source clauses to enable clause_id tracing on each flag.
 */
export function computeRiskFlags(
  agreement: Agreement,
  clauses: readonly ClauseBlock[] = [],
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  const pricingIds = clauseIdsByType(clauses, ['pricing_terms']);
  const constraintIds = clauseIdsByType(clauses, ['constraint']);
  const terminationIds = clauseIdsByType(clauses, ['termination']);
  const structuralIds = clauseIdsByType(clauses, ['structural']);
  const allIds = clauses.map((c) => c.clause_id);

  // High dilution risk: discount ≥ 3% combined with variable pricing modes (spec rule)
  if (
    agreement.pricing?.discount_rate !== undefined &&
    agreement.pricing.discount_rate >= 0.03 &&
    agreement.pricing.has_variable_pricing
  ) {
    flags.push({
      code: 'high_dilution_risk',
      severity: 'high',
      message:
        'Purchase discount ≥ 3% combined with variable pricing modes — elevated dilution risk.',
      clause_ids: pricingIds,
    });
  } else if (
    agreement.pricing?.discount_rate !== undefined &&
    agreement.pricing.discount_rate >= 0.03
  ) {
    // discount alone without variable pricing — lower severity
    flags.push({
      code: 'purchase_discount_3pct_or_higher',
      severity: 'medium',
      message:
        'Purchase discount (block or mode) is at or above 3% — review dilution / pricing impact.',
      clause_ids: pricingIds,
    });
  }

  if (agreement.constraints?.exchange_issuance_cap_rate !== undefined) {
    if (agreement.constraints.exchange_issuance_cap_rate >= 0.15) {
      flags.push({
        code: 'broad_issuance_headroom',
        severity: 'medium',
        message: 'Exchange / issuance cap rate is at or above 15% of relevant base.',
        clause_ids: constraintIds,
      });
    }
  }

  // Weak ownership protection: cap allows concentrated ownership without triggering notice
  if (
    agreement.constraints?.beneficial_ownership_cap_rate !== undefined &&
    agreement.constraints.beneficial_ownership_cap_rate >= 0.0499
  ) {
    flags.push({
      code: 'weak_ownership_protection',
      severity: 'high',
      message: `Beneficial ownership cap is at or above 4.99% — may permit concentrated ownership without disclosure trigger.`,
      clause_ids: constraintIds,
    });
  }

  // Missing constraints entirely — no ownership or issuance protections present
  if (!agreement.constraints) {
    flags.push({
      code: 'missing_constraints',
      severity: 'medium',
      message:
        'No ownership or issuance constraints found — review for missing protective provisions.',
      clause_ids: [],
    });
  }

  if (
    agreement.termination?.aggregate_purchase_ceiling_usd !== undefined &&
    agreement.termination.aggregate_purchase_ceiling_usd >= 25_000_000
  ) {
    flags.push({
      code: 'large_commitment_usd',
      severity: 'low',
      message: 'Aggregate purchase / commitment notional is large (≥ $25M) — size risk.',
      clause_ids: terminationIds,
    });
  }

  if (
    agreement.termination?.termination_notice_days !== undefined &&
    agreement.termination.termination_notice_days <= 5
  ) {
    flags.push({
      code: 'short_termination_notice',
      severity: 'high',
      message: 'Termination notice is short (≤ 5 days) for the issuer or counterparty.',
      clause_ids: terminationIds,
    });
  }

  if (agreement.metadata.confidence < 0.7) {
    flags.push({
      code: 'low_layer2_confidence',
      severity: 'medium',
      message: 'Mean clause confidence is below 0.7 — verify extraction.',
      clause_ids: allIds.length > 0
        ? clauses.filter((c) => c.confidence < 0.7).map((c) => c.clause_id)
        : [],
    });
  }

  for (const conf of agreement.metadata.conflicts) {
    if (conf.domain === 'pricing') {
      flags.push({
        code: 'pricing_inconsistency',
        severity: 'high',
        message: conf.message,
        clause_ids: pricingIds,
      });
    } else if (conf.domain === 'agreement') {
      flags.push({
        code: 'agreement_date_inconsistency',
        severity: 'medium',
        message: conf.message,
        clause_ids: structuralIds,
      });
    } else {
      flags.push({
        code: 'conflicting_terms',
        severity: 'medium',
        message: conf.message,
        clause_ids: allIds,
      });
    }
  }

  return flags;
}

// --- Public builder --------------------------------------------------------

export function buildAgreement(clauses: readonly ClauseBlock[]): Agreement {
  if (clauses.length === 0) {
    throw new Error('buildAgreement: at least one ClauseBlock is required');
  }
  const ordered = [...clauses].sort((a, b) => a.clause_id.localeCompare(b.clause_id));
  const allConflicts: AgreementConflict[] = [];
  const { value: terms, conflicts: tConf } = extractAgreementTerms(ordered);
  allConflicts.push(...tConf);
  const { value: pr, conflicts: pConf } = extractPricing(ordered);
  allConflicts.push(...pConf);
  const { value: co, conflicts: cConf } = extractConstraints(ordered);
  allConflicts.push(...cConf);
  const { value: tr, conflicts: trConf } = extractTermination(ordered);
  allConflicts.push(...trConf);
  const { value: di, conflicts: dConf } = extractDisclosure(ordered);
  allConflicts.push(...dConf);

  const high = countHighPriority(ordered);
  const conf = averageConfidence(ordered);
  const metadata: AgreementMetadata = {
    clause_count: ordered.length,
    high_priority_clause_count: high,
    confidence: conf,
    conflicts: allConflicts,
  };

  const a: Agreement = {
    agreement_id: generateAgreementId(ordered),
    primary_entity_id: ordered[0]!.primary_entity_id,
    counterparty_entity_ids: uniqueSortedCounterparties(ordered),
    clause_ids: ordered.map((c) => c.clause_id),
    agreement: terms,
    pricing: pr,
    constraints: co,
    termination: tr,
    disclosure: di,
    risk_flags: [],
    metadata,
  };
  // Pass source clauses so risk flags carry clause_ids for traceability
  a.risk_flags = computeRiskFlags(a, ordered);
  return a;
}

export function buildAgreements(clauses: readonly ClauseBlock[]): Agreement[] {
  if (clauses.length === 0) return [];
  return groupByAgreement(clauses).map((g) => buildAgreement(g));
}

/** Human-readable one-page summary for embeddings / RAG chunks. */
export function summarizeAgreement(a: Agreement): string {
  const lines: string[] = [
    `Agreement ${a.agreement_id}`,
    `Primary: ${a.primary_entity_id || '(unknown)'}`,
    `Counterparties: ${a.counterparty_entity_ids.length ? a.counterparty_entity_ids.join(', ') : '(none)'}`,
    `Clauses: ${a.clause_ids.join(', ')}`,
  ];
  if (a.agreement.agreement_reference_date_iso || a.agreement.execution_date_iso) {
    lines.push(
      `Dates: ref ${a.agreement.agreement_reference_date_iso ?? '—'}, execution ${a.agreement.execution_date_iso ?? '—'}`,
    );
  }
  if (a.pricing) {
    lines.push(
      `Pricing: ${a.pricing.mechanism} / ${a.pricing.settlement_method}, discount ${
        a.pricing.discount_rate ?? 'n/a'
      }, variable modes: ${a.pricing.has_variable_pricing}`,
    );
  }
  if (a.constraints) {
    const bits: string[] = [];
    if (a.constraints.exchange_issuance_cap_rate !== undefined) {
      bits.push(`ex issuance cap ≲ ${(a.constraints.exchange_issuance_cap_rate * 100).toFixed(2)}%`);
    }
    if (a.constraints.beneficial_ownership_cap_rate !== undefined) {
      bits.push(`beneficial cap ≲ ${(a.constraints.beneficial_ownership_cap_rate * 100).toFixed(2)}%`);
    }
    if (bits.length) lines.push(`Constraints: ${bits.join('; ')}`);
  }
  if (a.termination) {
    const t: string[] = [];
    if (a.termination.aggregate_purchase_ceiling_usd !== undefined) {
      t.push(`ceiling $${a.termination.aggregate_purchase_ceiling_usd}`);
    }
    if (a.termination.stated_term_months !== undefined) {
      t.push(`term ${a.termination.stated_term_months} mo`);
    }
    if (a.termination.stated_term_days !== undefined) {
      t.push(`term ${a.termination.stated_term_days} d`);
    }
    if (a.termination.termination_notice_days !== undefined) {
      t.push(`notice ${a.termination.termination_notice_days} d`);
    }
    if (t.length) lines.push(`Termination: ${t.join(', ')}`);
  }
  if (a.disclosure) {
    const d: string[] = [];
    if (a.disclosure.financial_largest_amount_usd !== undefined) {
      d.push(`largest $ amount ${a.disclosure.financial_largest_amount_usd}`);
    }
    if (a.disclosure.issuance_largest_share_count !== undefined) {
      d.push(`largest share count ${a.disclosure.issuance_largest_share_count}`);
    }
    if (d.length) lines.push(`Disclosure: ${d.join('; ')}`);
  }
  lines.push(
    `Metadata: ${a.metadata.clause_count} clauses, ${a.metadata.high_priority_clause_count} high priority, mean confidence ${a.metadata.confidence}`,
  );
  if (a.risk_flags.length) {
    lines.push(
      `Risks: ${a.risk_flags.map((f) => `[${f.severity}] ${f.code}`).join('; ')}`,
    );
  }
  if (a.metadata.conflicts.length) {
    lines.push(
      `Conflicts: ${a.metadata.conflicts.map((c) => c.message).join(' | ')}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
