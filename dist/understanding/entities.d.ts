/**
 * Deterministic entity cues (no NER): agreements, SEC registrant lines, parties, instruments.
 */
/** Extract party-like phrases from common contract phrases (conservative). */
export declare function extractEntities(text: string): {
    parties: string[] | null;
    instruments: string[] | null;
};
//# sourceMappingURL=entities.d.ts.map