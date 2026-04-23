import type { FilingHeaderStructured } from './filing-header-types.js';
/**
 * Deterministic SEC-style header parse (no NLP). Anchored fields — no concatenated junk strings.
 */
export declare function parseFilingHeader(rawText: string): FilingHeaderStructured;
//# sourceMappingURL=parse-filing-header.d.ts.map