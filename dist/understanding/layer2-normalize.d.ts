import type { FactsV2, TimeWindowV2, UsdAmount } from '../layer1/types.js';
import type { TerminationSchema } from './normalized-clause.js';
/** Layer 1 stores percentage points (e.g. 19.99); Layer 2 uses unit interval [0, 1]. */
export declare function percentPointsToRate(points: number): number;
export declare function usdToNumber(u: UsdAmount): number;
/**
 * Termination v2: flat fields only.
 * Safe inference: if `stated_term_months` is set and there is exactly one 30-day window
 * and at most one distinct non-30 day value among other day windows, set `stated_term_days = 30`
 * and optional `termination_notice_days` from that lone non-30 value.
 */
export declare function terminationFlatFromFacts(facts: FactsV2): TerminationSchema;
export declare function timeWindowsToExplicit(tws: TimeWindowV2[]): {
    months?: number;
    days?: number;
    years?: number;
};
export declare function mergeFacts(parts: FactsV2[]): FactsV2;
export declare function isNonEmptyFacts(f: FactsV2): boolean;
export declare function maxUsd(facts: FactsV2): number | undefined;
export declare function minPriceThresholdUsd(facts: FactsV2): number | undefined;
export declare function maxShareCount(facts: FactsV2): number | undefined;
export declare function dateEarliestLatest(facts: FactsV2): {
    earliest?: string;
    latest?: string;
};
/** First stated term in months from time windows (structural / summary). */
export declare function statedTermMonthsFromFacts(facts: FactsV2): number | undefined;
//# sourceMappingURL=layer2-normalize.d.ts.map