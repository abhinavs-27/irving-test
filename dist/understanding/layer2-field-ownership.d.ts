/**
 * Single-domain Layer 2 projection: one ExtractedFields key per clause_type,
 * allowlisted field keys per domain (no cross-domain leakage, no schema drift).
 */
import type { ClauseType, ClausePriority, ExtractedFields } from './normalized-clause.js';
/** Maps clause_type → the sole key allowed in `extracted_fields` (undefined → must be `{}`). */
export declare const DOMAIN_BY_CLAUSE_TYPE: Record<ClauseType, keyof ExtractedFields | undefined>;
export declare const PRIORITY_BY_TYPE: Record<ClauseType, ClausePriority>;
/**
 * Retain a single domain per `clause_type`, allowlist keys, omit empty domain objects.
 */
export declare function applyStrictExtractedFields(ef: ExtractedFields, clause_type: ClauseType): ExtractedFields;
//# sourceMappingURL=layer2-field-ownership.d.ts.map