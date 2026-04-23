import type { SubstantiveClauseType } from './types.js';
/**
 * When regex scoring ties / misses, infer a substantive clause type from SEC filing signals.
 * Exhibit refs, filing headers, signature attestations carry legal semantics (not misc.noise).
 */
export declare function inferSubstantiveTypeFallback(text: string): SubstantiveClauseType | null;
//# sourceMappingURL=type-inference.d.ts.map