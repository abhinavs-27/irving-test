import type { Clause } from '../clause/clause.js';
/**
 * Paragraph-level atomic units: `{sectionId}.p1`, `{sectionId}.p2`, …
 * Multi-concept paragraphs are split further into atomic clause nodes.
 */
export declare function splitIntoParagraphs(section: Clause): Clause[];
/**
 * Attach paragraph children; **section body text is cleared** when children exist (children win).
 */
export declare function withParagraphChildren(section: Clause): Clause;
/**
 * Run paragraph splitting on every SEC segment that carries body text.
 */
export declare function segmentSectionsIntoParagraphs(sections: Clause[]): Clause[];
//# sourceMappingURL=split-paragraphs.d.ts.map