import type { ClauseBlock, ExtractedFields } from './normalized-clause.js';
export type ClauseBlockValidationIssue = {
    code: string;
    path: string;
    message: string;
};
export type ClauseBlockValidationResult = {
    ok: boolean;
    issues: ClauseBlockValidationIssue[];
};
/** Remove empty domain objects and partially empty disclosure branches (v1.1). */
export declare function omitEmptyExtractedFields(fields: ExtractedFields): ExtractedFields;
/**
 * Validate a single Layer 2 {@link ClauseBlock}. Non-conformant rows produce issues;
 * callers may log or throw based on severity.
 */
export declare function validateClauseBlock(record: ClauseBlock): ClauseBlockValidationResult;
//# sourceMappingURL=layer2-validate.d.ts.map