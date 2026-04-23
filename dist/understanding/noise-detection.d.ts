/**
 * misc.noise only when there is **no** extractable legal/SEC semantic content worth classifying.
 * Exhibit references, signatures, filing headers are **signals**, not noise bucket triggers.
 */
export type SignalCode = 'form_header' | 'exhibit_reference' | 'signature_block' | 'low_character_count';
/** Tokens / patterns indicating non-noise semantics (even in short paragraphs). */
export declare function hasStrongSemanticSignals(text: string): boolean;
/**
 * Boilerplate / exhibit / signature — still **signal** for classification (not misc.noise by default).
 */
export declare function collectSignalCodes(text: string): SignalCode[];
/** Repeated navigation crumbs / duplicate Item line only (no body). */
export declare function isPureNavigationOrStructuralRepetition(text: string): boolean;
export declare function isLowInformationContent(text: string): boolean;
//# sourceMappingURL=noise-detection.d.ts.map