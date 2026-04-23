import type { Clause } from './clause.js';
/**
 * Nest clauses by numbering: `2` → `2.1` → `2.1(a)`.
 * Returns roots only (orphans when parent id is missing become roots with a warning).
 */
export declare function buildHierarchy(flat: Clause[]): Clause[];
//# sourceMappingURL=hierarchy.d.ts.map