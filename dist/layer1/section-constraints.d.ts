import type { Clause } from '../clause/clause.js';
import type { SectionConstraintEntry } from './types.js';
/**
 * 19.99% → `exchange_issuance_cap`. 4.99% → `beneficial_ownership_cap`.
 * Keyword fallbacks when % not normalized into facts.
 */
export declare function buildSectionConstraints(section: Clause): SectionConstraintEntry[];
//# sourceMappingURL=section-constraints.d.ts.map