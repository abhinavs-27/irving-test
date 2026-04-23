import type { EntityRegistry } from './types.js';
import type { FactsV2, UsdAmount } from './types.js';
import type { FilingSectionNode } from './filing-types.js';
/** Convert percent points (e.g. 19.99) to decimal fraction (0.1999). */
export declare function percentagePointsToDecimal(points: number): number;
/** Normalize facts: add `percentage_decimals` parallel to percentages; coerce money shape. */
export declare function normalizeFactsDecimals(facts: FactsV2): FactsV2 & {
    percentage_decimals?: number[];
};
/** Ensure USD amounts use { value, currency: 'USD' }. */
export declare function normalizeUsdAmount(u: Partial<UsdAmount>): UsdAmount | null;
/** Normalize date strings to ISO YYYY-MM-DD when parseable. */
export declare function normalizeIsoDate(raw: string): string | null;
/** Resolve alias / fragment to canonical org id when possible. */
export declare function resolveAliasToEntityId(phrase: string, registry: EntityRegistry): string | undefined;
/** Walk section tree and attach normalized facts copy on paragraph nodes (immutable input safe if caller clones). */
export declare function applyNormalizedFactsToSections(nodes: FilingSectionNode[] | undefined): FilingSectionNode[] | undefined;
//# sourceMappingURL=filing-normalize.d.ts.map