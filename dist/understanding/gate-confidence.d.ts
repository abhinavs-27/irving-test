import type { SubstantiveClauseType } from './types.js';
import type { SignalCode } from './noise-detection.js';
/**
 * Low band: only signal_codes in extracted_fields (or empty object).
 */
export declare function buildLowBandFields(signalCodes: SignalCode[]): Record<string, unknown>;
/**
 * Mid band: drop nested / derived / optional fields per type.
 */
export declare function reduceFieldsForMediumConfidence(clauseType: SubstantiveClauseType, fields: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=gate-confidence.d.ts.map