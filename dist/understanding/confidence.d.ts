import type { LegalClauseType, SubstantiveClauseType } from './types.js';
/**
 * Field-fill ratio: non-null meaningful values / total keys.
 */
export declare function computeFieldFillRatio(fields: Record<string, unknown>): number;
export declare function blendConfidence(fieldRatio: number, separationStrength: number): number;
/** Short paragraphs are inherently lower confidence for semantic typing. */
export declare function lengthPrior(text: string): number;
export declare function computeUnderstandingConfidence(substantiveType: SubstantiveClauseType | null, fullFields: Record<string, unknown>, separationStrength: number, text: string): number;
export declare function confidenceTier(conf: number): 'low' | 'medium' | 'high';
export type CalibrationInput = {
    clauseId: string;
    clauseType: LegalClauseType;
    entitiesResolved: boolean;
    /** Short paragraph split artifact / duplicate fragment heuristic. */
    fragmentedClause: boolean;
    /** misc.noise inside Item 1.01 body despite semantic cues — penalize certainty. */
    noiseLikelyMisclassified: boolean;
    /** §1.01-style Items where parties matter for pricing / termination. */
    missingEntitiesForSignificantClause: boolean;
};
/** Context-aware calibration after base classifier scoring. */
export declare function calibrateConfidence(base: number, opts: CalibrationInput): number;
export declare function inferFragmentation(text: string): boolean;
export declare function entitiesAreResolved(parties: {
    company: string | null;
    counterparty: string | null;
}, instruments: string[] | null): boolean;
export declare function shouldFlagMissingEntitiesForSection(clauseType: LegalClauseType, clauseId: string, entitiesResolved: boolean): boolean;
export declare function noiseMisclassifiedSuspicion(clauseType: LegalClauseType, clauseId: string, hadSemanticSignals: boolean): boolean;
//# sourceMappingURL=confidence.d.ts.map