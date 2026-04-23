/**
 * Merge false `\n\n` paragraph breaks introduced by PDF layout when the prior block
 * clearly continues mid-sentence (stream-safe; does not split on `.` inside abbreviations).
 */
/**
 * Join adjacent `\n\n` blocks when the first does not end a sentence boundary and the
 * second looks like a grammatical continuation (lowercase lead, quotation, etc.).
 */
export declare function mergeSoftParagraphBreaks(raw: string): string;
//# sourceMappingURL=merge-paragraph-glue.d.ts.map