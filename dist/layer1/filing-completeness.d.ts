import type { Layer1Filing } from './filing-types.js';
export type CompletenessSeverity = 'info' | 'warn' | 'missing';
export type CompletenessFinding = {
    code: string;
    severity: CompletenessSeverity;
    message: string;
};
export type CompletenessReport = {
    ok: boolean;
    findings: CompletenessFinding[];
};
export declare function checkCompleteness(filing: Layer1Filing): CompletenessReport;
//# sourceMappingURL=filing-completeness.d.ts.map