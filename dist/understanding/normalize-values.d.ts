/**
 * Deterministic parsers for normalized numeric / symbolic outputs (USD base unit: dollars).
 */
/** Parse `$1,234.56` → 1234.56 */
export declare function parseUsdScalar(raw: string): number | null;
/** All dollar amounts in text as USD floats (dedupe close duplicates tolerantly). */
export declare function extractUsdAmounts(text: string): number[];
/** Percentage literal → numeric (e.g. 19.99 from "19.99%"). */
export declare function parsePercentLiteral(text: string): number | null;
/** Collect percentage values when context suggests regulatory / ownership caps. */
export declare function extractPercentValues(text: string): number[];
/**
 * Rudimentary ISO date extraction (SEC filings). Returns null if ambiguous.
 */
export declare function extractIsoDates(text: string): string[];
//# sourceMappingURL=normalize-values.d.ts.map