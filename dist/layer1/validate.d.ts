import type { Clause } from '../clause/clause.js';
export type Layer1ValidationIssue = {
    path: string;
    code: string;
    message: string;
};
export type Layer1ValidationResult = {
    ok: boolean;
    issues: Layer1ValidationIssue[];
};
export declare function validateLayer1Tree(clauses: Clause[]): Layer1ValidationResult;
//# sourceMappingURL=validate.d.ts.map