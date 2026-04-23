/**
 * Cross-clause entity normalization: canonical instrument labels and structured parties.
 */
import type { ResolvedParties } from './types.js';
export type RawEntities = {
    parties: string[] | null;
    instruments: string[] | null;
};
export declare function canonicalizeInstrument(raw: string): string;
/** When the document references B. Riley, collapse generic Purchase Agreement to the CSPAs. */
export declare function canonicalizeInstrumentsForDocument(list: string[] | null, documentText: string): string[] | null;
/** Normalize whitespace and dedupe case-insensitively (keep first canonical casing). */
export declare function canonicalizeParty(raw: string): string;
export declare function resolveInstruments(list: string[] | null): string[] | null;
/**
 * Map raw party phrases to `{ company, counterparty }`; null if insufficient signal.
 */
export declare function resolvePartiesToRoles(list: string[] | null, text: string): ResolvedParties | null;
export declare function mergeEntities(a: RawEntities, b: RawEntities): RawEntities;
//# sourceMappingURL=entity-resolution.d.ts.map