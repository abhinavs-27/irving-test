import type { BlockRegistryEntry } from '../layer1/block-registry.js';
import type { FilingSectionNode } from '../layer1/filing-types.js';
import type {
  BlockPricingModel,
  BlockPricingModelMode,
  FactsV2,
  GraphEvent,
  SectionConstraintEntry,
} from '../layer1/types.js';
import type {
  BeneficialOwnershipConstraint,
  ConstraintSchema,
  DisclosureSchema,
  ExchangeIssuanceConstraint,
  ExtractedFields,
  GenericConstraint,
  NormalizedClauseType,
  PricingMechanism,
  PricingMode,
  PricingSchema,
  StructuralSchema,
  TerminationSchema,
} from './normalized-clause.js';
import {
  dateEarliestLatest,
  isNonEmptyFacts,
  maxShareCount,
  maxUsd,
  mergeFacts,
  percentPointsToRate,
  terminationFlatFromFacts,
  usdToNumber,
} from './layer2-normalize.js';

function emptyFacts(): FactsV2 {
  return {
    percentages: [],
    dollar_amounts: [],
    share_counts: [],
    price_thresholds: [],
    dates: [],
    time_windows: [],
  };
}

function rawModeFromLayer1(m: BlockPricingModelMode): PricingMode & { discount_rate?: number } {
  const vwap_session =
    m.vwap_window === 'intraday_segments'
      ? 'intraday_segments'
      : m.vwap_window === 'intraday'
        ? 'intraday'
        : 'full_session';
  return {
    purchase_mode: String(m.name),
    vwap_session,
    ...(m.discount_percent !== undefined
      ? { discount_rate: percentPointsToRate(m.discount_percent) }
      : {}),
    ...(m.volume_threshold_truncation !== undefined
      ? { volume_adjusted: m.volume_threshold_truncation }
      : {}),
    ...(m.excludes_open_close !== undefined
      ? { excludes_open_close: m.excludes_open_close }
      : {}),
    ...(m.multi_window !== undefined
      ? { multi_segment_intraday: m.multi_window }
      : {}),
  };
}

function inferMechanismAndSettlement(
  block: BlockRegistryEntry,
  pm: BlockPricingModel | undefined,
  paraById: Map<string, FilingSectionNode>,
): { mechanism: PricingMechanism; settlement_method: string } {
  if (pm?.type === 'vwap_discount') {
    return { mechanism: 'vwap_discount', settlement_method: pm.method };
  }
  for (const pid of block.paragraph_ids) {
    const m = paraById.get(pid)?.pricing?.method;
    if (m === 'VWAP') return { mechanism: 'vwap_discount', settlement_method: 'VWAP' };
    if (m === 'FIXED') return { mechanism: 'fixed_price', settlement_method: 'FIXED' };
    if (m === 'FORMULA') return { mechanism: 'other', settlement_method: 'UNKNOWN' };
  }
  return { mechanism: 'other', settlement_method: 'UNKNOWN' };
}

/** v2: block-level and per-mode `discount_rate` when Layer 1 provides them. */
export function buildPricingSchema(
  block: BlockRegistryEntry,
  merged: FactsV2 | undefined,
  pm: BlockPricingModel | undefined,
  paraById: Map<string, FilingSectionNode>,
): PricingSchema {
  const { mechanism, settlement_method } = inferMechanismAndSettlement(
    block,
    pm,
    paraById,
  );

  const rawModes: Array<PricingMode & { discount_rate?: number }> =
    mechanism === 'vwap_discount' && pm ? pm.modes.map(rawModeFromLayer1) : [];

  const modeRates = rawModes
    .map((m) => m.discount_rate)
    .filter((r): r is number => r !== undefined);
  let blockDiscount: number | undefined;
  if (modeRates.length > 0) {
    const uniq = new Set(modeRates);
    blockDiscount =
      uniq.size === 1 ? modeRates[0]! : Math.max(...modeRates);
  }

  const pricing: PricingSchema = {
    mechanism,
    settlement_method,
    ...(blockDiscount !== undefined ? { discount_rate: blockDiscount } : {}),
    ...(rawModes.length > 0 ? { modes: rawModes } : {}),
  };
  return pricing;
}

function exchangeFromSection(row: SectionConstraintEntry): {
  row: ExchangeIssuanceConstraint;
  other: GenericConstraint[];
} {
  const vals = row.values;
  const out: ExchangeIssuanceConstraint = {};
  const other: GenericConstraint[] = [];
  if (vals?.share_cap !== undefined) out.share_cap = vals.share_cap;
  if (vals?.percentages?.length) {
    out.issuance_cap_rate = percentPointsToRate(
      Math.max(...vals.percentages.map(Math.abs)),
    );
  }
  if (vals?.dollar_cap) {
    other.push({
      kind: 'usd_ceiling',
      numeric_value: usdToNumber(vals.dollar_cap),
    });
  }
  return { row: out, other };
}

function beneficialFromSection(
  row: SectionConstraintEntry,
): BeneficialOwnershipConstraint | null {
  const vals = row.values;
  if (!vals?.percentages?.length) return null;
  return {
    cap_rate: percentPointsToRate(Math.min(...vals.percentages.map(Math.abs))),
  };
}

export function buildConstraintSchema(
  rows: SectionConstraintEntry[],
  merged: FactsV2 | undefined,
  issuerId: string,
  counterpartyIds: string[],
): ConstraintSchema {
  const exchange_issuance: ExchangeIssuanceConstraint[] = [];
  const beneficial_ownership: BeneficialOwnershipConstraint[] = [];
  const other_accum: GenericConstraint[] = [];

  const appliesIssuer = issuerId;
  const appliesCp = counterpartyIds[0] ?? '';

  for (const row of rows) {
    if (row.kind === 'exchange_issuance_cap') {
      const { row: ex, other } = exchangeFromSection(row);
      if (ex.share_cap !== undefined || ex.issuance_cap_rate !== undefined) {
        exchange_issuance.push(ex);
      }
      other_accum.push(...other);
    } else {
      const b = beneficialFromSection(row);
      if (b) beneficial_ownership.push(b);
    }
  }

  const facts = merged;
  if (rows.length === 0 && facts && isNonEmptyFacts(facts)) {
    const maxPct = facts.percentages.length
      ? Math.max(...facts.percentages.map(Math.abs))
      : undefined;
    const minPct = facts.percentages.length
      ? Math.min(...facts.percentages.map(Math.abs))
      : undefined;
    const maxUsdVal = maxUsd(facts);
    const maxShares = maxShareCount(facts);
    if (appliesIssuer && (maxPct !== undefined || maxShares !== undefined)) {
      const r: ExchangeIssuanceConstraint = {};
      if (maxShares !== undefined) r.share_cap = maxShares;
      if (maxPct !== undefined) r.issuance_cap_rate = percentPointsToRate(maxPct);
      exchange_issuance.push(r);
    }
    if (maxUsdVal !== undefined) {
      other_accum.push({
        kind: 'usd_ceiling',
        numeric_value: maxUsdVal,
      });
    }
    if (
      appliesCp &&
      minPct !== undefined &&
      maxPct !== undefined &&
      minPct < maxPct
    ) {
      beneficial_ownership.push({
        cap_rate: percentPointsToRate(minPct),
      });
    }
  }

  const c: ConstraintSchema = {};
  if (exchange_issuance.length > 0) c.exchange_issuance = exchange_issuance;
  if (beneficial_ownership.length > 0) c.beneficial_ownership = beneficial_ownership;
  if (other_accum.length > 0) c.other_constraints = other_accum;
  return c;
}

export function buildTerminationSchema(merged: FactsV2 | undefined): TerminationSchema {
  const facts = merged ?? emptyFacts();
  return terminationFlatFromFacts(facts);
}

export function buildDisclosureSchema(merged: FactsV2 | undefined): DisclosureSchema {
  const facts = merged ?? emptyFacts();
  const dollars = facts.dollar_amounts.map((d) => d.value).filter((x) => x > 0);
  const d: DisclosureSchema = {};
  if (dollars.length > 0) {
    d.financial = { largest_amount_usd: Math.max(...dollars) };
  }
  const sc = maxShareCount(facts);
  if (sc !== undefined) {
    d.issuance = { largest_share_count: sc };
  }
  return d;
}

/** ISO dates only (no economic fields). */
export function buildStructuralSchema(
  merged: FactsV2 | undefined,
  executionDateIso: string | undefined,
): StructuralSchema {
  const facts = merged ?? emptyFacts();
  const dl = dateEarliestLatest(facts);
  const earliest = dl.earliest;
  const s: StructuralSchema = {};

  if (earliest !== undefined) {
    s.agreement_reference_date_iso = earliest;
  }
  if (executionDateIso !== undefined) {
    s.execution_date_iso = executionDateIso;
  }

  return s;
}

function executionDateFromEvents(linked: GraphEvent[]): string | undefined {
  const exec = linked.find((e) => e.kind === 'agreement_execution');
  return exec?.as_of_date;
}

export function buildExtractedFieldsForBlock(
  clause_type: NormalizedClauseType,
  block: BlockRegistryEntry,
  mergedFacts: FactsV2 | undefined,
  relevantConstraints: SectionConstraintEntry[],
  paraById: Map<string, FilingSectionNode>,
  linkedEvents: GraphEvent[],
  issuerId: string,
  counterpartyEntityIds: string[],
): ExtractedFields {
  const out: ExtractedFields = {};
  const execIso = executionDateFromEvents(linkedEvents);

  switch (clause_type) {
    case 'pricing_terms':
      out.pricing = buildPricingSchema(
        block,
        mergedFacts,
        block.pricing_model,
        paraById,
      );
      break;
    case 'constraint':
      out.constraints = buildConstraintSchema(
        relevantConstraints,
        mergedFacts,
        issuerId,
        counterpartyEntityIds,
      );
      break;
    case 'termination':
      out.termination = buildTerminationSchema(mergedFacts);
      break;
    case 'disclosure':
      out.disclosure = buildDisclosureSchema(mergedFacts);
      break;
    case 'structural': {
      const dates = buildStructuralSchema(mergedFacts, execIso);
      if (Object.keys(dates).length > 0) out.structural = dates;
      break;
    }
    case 'obligation':
    case 'indemnity':
    case 'payment':
    case 'other':
      break;
    default: {
      const _n: never = clause_type;
      return _n;
    }
  }

  return pruneEmptyExtractedFields(out);
}

/** Omit empty domain objects; if nothing remains, `{}`. */
export function pruneEmptyExtractedFields(ef: ExtractedFields): ExtractedFields {
  const o: ExtractedFields = {};

  if (ef.pricing !== undefined && Object.keys(ef.pricing).length > 0) {
    o.pricing = ef.pricing;
  }

  if (ef.constraints !== undefined) {
    const c = ef.constraints;
    const n =
      (c.exchange_issuance?.length ?? 0) +
      (c.beneficial_ownership?.length ?? 0) +
      (c.other_constraints?.length ?? 0);
    if (n > 0) o.constraints = c;
  }

  if (ef.termination !== undefined && Object.keys(ef.termination).length > 0) {
    o.termination = ef.termination;
  }

  if (ef.disclosure !== undefined) {
    const d = ef.disclosure;
    const hasFin = d.financial?.largest_amount_usd !== undefined;
    const hasIss = d.issuance?.largest_share_count !== undefined;
    if (hasFin || hasIss) o.disclosure = d;
  }

  if (ef.structural !== undefined && Object.keys(ef.structural).length > 0) {
    o.structural = ef.structural;
  }

  if (ef.obligations !== undefined && Object.keys(ef.obligations).length > 0) {
    o.obligations = ef.obligations;
  }

  return o;
}

export { mergeFacts, isNonEmptyFacts } from './layer2-normalize.js';
