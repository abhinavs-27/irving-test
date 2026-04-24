import type { FactsV2, TimeWindowV2, UsdAmount } from '../layer1/types.js';
import type { TerminationSchema } from './normalized-clause.js';

/** Layer 1 stores percentage points (e.g. 19.99); Layer 2 uses unit interval [0, 1]. */
export function percentPointsToRate(points: number): number {
  return Math.round((points / 100) * 1e12) / 1e12;
}

export function usdToNumber(u: UsdAmount): number {
  return u.value;
}

/**
 * Termination v2: flat fields only.
 * Safe inference: if `stated_term_months` is set and there is exactly one 30-day window
 * and at most one distinct non-30 day value among other day windows, set `stated_term_days = 30`
 * and optional `termination_notice_days` from that lone non-30 value.
 */
export function terminationFlatFromFacts(facts: FactsV2): TerminationSchema {
  const tw = facts.time_windows;
  const monthW = tw.filter((t) => t.unit === 'month');
  const yearW = tw.filter((t) => t.unit === 'year');
  const dayW = tw.filter((t) => t.unit === 'day');

  const out: TerminationSchema = {};
  if (monthW.length > 0) out.stated_term_months = monthW[0]!.value;
  else if (yearW.length > 0) out.stated_term_months = yearW[0]!.value * 12;

  const dayVals = dayW.map((d) => d.value);
  const thirtyCount = dayVals.filter((v) => v === 30).length;
  const non30 = dayVals.filter((v) => v !== 30);
  const distinctNon30 = [...new Set(non30)];

  let applied30Rule = false;
  if (
    out.stated_term_months !== undefined &&
    thirtyCount === 1 &&
    distinctNon30.length <= 1
  ) {
    out.stated_term_days = 30;
    applied30Rule = true;
    if (distinctNon30.length === 1) {
      out.termination_notice_days = distinctNon30[0]!;
    }
  }

  if (!applied30Rule) {
    if (out.stated_term_months === undefined && dayW.length === 1) {
      out.stated_term_days = dayW[0]!.value;
    } else if (out.stated_term_months === undefined && dayW.length > 1) {
      out.stated_term_days = Math.max(...dayVals);
      out.termination_notice_days = Math.min(...dayVals);
    } else if (out.stated_term_months !== undefined && dayW.length > 0) {
      out.termination_notice_days = Math.min(...dayVals);
    }
  }

  const dollars = facts.dollar_amounts.map((d) => d.value);
  if (dollars.length > 0) {
    out.aggregate_purchase_ceiling_usd = Math.max(...dollars);
  }
  return out;
}

export function timeWindowsToExplicit(tws: TimeWindowV2[]): {
  months?: number;
  days?: number;
  years?: number;
} {
  let months: number | undefined;
  let days: number | undefined;
  let years: number | undefined;
  for (const tw of tws) {
    if (tw.unit === 'month' && months === undefined) months = tw.value;
    else if (tw.unit === 'day' && days === undefined) days = tw.value;
    else if (tw.unit === 'year' && years === undefined) years = tw.value;
  }
  return {
    ...(months !== undefined ? { months } : {}),
    ...(days !== undefined ? { days } : {}),
    ...(years !== undefined ? { years } : {}),
  };
}

export function mergeFacts(parts: FactsV2[]): FactsV2 {
  const stableDedupeJson = <T>(rows: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of rows) {
      const k = JSON.stringify(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  };
  return {
    percentages: stableDedupeJson(parts.flatMap((p) => p.percentages)),
    dollar_amounts: stableDedupeJson(parts.flatMap((p) => p.dollar_amounts)),
    share_counts: stableDedupeJson(parts.flatMap((p) => p.share_counts)),
    price_thresholds: stableDedupeJson(parts.flatMap((p) => p.price_thresholds)),
    dates: stableDedupeJson(parts.flatMap((p) => p.dates)),
    time_windows: stableDedupeJson(parts.flatMap((p) => p.time_windows)),
  };
}

export function isNonEmptyFacts(f: FactsV2): boolean {
  return (
    f.percentages.length > 0 ||
    f.dollar_amounts.length > 0 ||
    f.share_counts.length > 0 ||
    f.price_thresholds.length > 0 ||
    f.dates.length > 0 ||
    f.time_windows.length > 0
  );
}

export function maxUsd(facts: FactsV2): number | undefined {
  const vals = facts.dollar_amounts.map((d) => d.value);
  if (vals.length === 0) return undefined;
  return Math.max(...vals);
}

export function minPriceThresholdUsd(facts: FactsV2): number | undefined {
  const vals = facts.price_thresholds.map((d) => d.value);
  if (vals.length === 0) return undefined;
  return Math.min(...vals);
}

export function maxShareCount(facts: FactsV2): number | undefined {
  if (facts.share_counts.length === 0) return undefined;
  return Math.max(...facts.share_counts);
}

export function dateEarliestLatest(facts: FactsV2): {
  earliest?: string;
  latest?: string;
} {
  const d = [...facts.dates].sort();
  if (d.length === 0) return {};
  return { earliest: d[0], latest: d[d.length - 1] };
}

/** First stated term in months from time windows (structural / summary). */
export function statedTermMonthsFromFacts(facts: FactsV2): number | undefined {
  const tw = facts.time_windows;
  const monthW = tw.filter((t) => t.unit === 'month');
  const yearW = tw.filter((t) => t.unit === 'year');
  if (monthW.length > 0) return monthW[0]!.value;
  if (yearW.length > 0) return yearW[0]!.value * 12;
  return undefined;
}
