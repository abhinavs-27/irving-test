import assert from 'node:assert';
import { describe, it } from 'vitest';
import { extractClauses } from './extract.js';
/** Synthetic messy PDF-like text: numbered lines + paragraphs. */
const SAMPLE = `
Preamble line that should not trigger a clause header mid-line 4.0 beta.

1 Definitions

Capitalized terms used in this Agreement have the meanings set forth below.

2 Representations and Warranties

2.1 Accuracy of Disclosure

The Company represents that the SEC Reports do not contain untrue statements.

2.1(a) Organization

Each subsidiary is duly organized.

Section 3.2 Covenants

The Borrower shall comply with affirmative and negative covenants.
`;
describe('extractClauses (two-pass)', () => {
    it('prints first 5 clauses, lengths, and keeps non-empty text', () => {
        const clauses = extractClauses(SAMPLE);
        console.log('\n--- First 5 clauses (debug) ---');
        for (let i = 0; i < Math.min(5, clauses.length); i++) {
            const c = clauses[i];
            console.log({
                rank: i + 1,
                id: c.id,
                title: c.title,
                textLength: c.text.length,
            });
        }
        assert.ok(clauses.length >= 5, `expected at least 5 clauses, got ${clauses.length}`);
        for (let i = 0; i < 5; i++) {
            const c = clauses[i];
            assert.strictEqual(c.type, 'paragraph');
            assert.ok(c.text.trim().length > 0, `clause ${c.id} should have non-empty text`);
            assert.deepStrictEqual(c.children, []);
        }
    });
});
//# sourceMappingURL=extract.test.js.map