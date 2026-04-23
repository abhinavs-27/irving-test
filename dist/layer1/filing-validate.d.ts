import type { Layer1Filing } from './filing-types.js';
export type FilingValidationIssue = {
    code: string;
    path: string;
    message: string;
};
export type FilingValidationResult = {
    ok: boolean;
    issues: FilingValidationIssue[];
};
/** Structural checks aligned with JSON Schema required fields (no external AJV dependency). */
export declare function validateFilingSchemaShape(filing: unknown): FilingValidationResult;
/** Business rules beyond JSON Schema (graph invariants). */
export declare function validateFilingRules(filing: Layer1Filing): FilingValidationResult;
/** Full pipeline: schema shape + graph rules. */
export declare function validateFiling(filing: unknown): FilingValidationResult & {
    schema: FilingValidationResult;
    rules: FilingValidationResult;
};
//# sourceMappingURL=filing-validate.d.ts.map