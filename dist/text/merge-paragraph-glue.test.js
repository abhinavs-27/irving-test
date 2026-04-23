import assert from 'node:assert';
import { describe, it } from 'vitest';
import { mergeSoftParagraphBreaks } from './merge-paragraph-glue.js';
describe('mergeSoftParagraphBreaks', () => {
    it('joins continuation lines after incomplete sentence', () => {
        const a = 'The prospectus supplement relating to the offering was filed pursuant to Rule 424(b) under the Securities Act';
        const b = 'and a final prospectus relating to the offering has been filed with the SEC.';
        const out = mergeSoftParagraphBreaks(`${a}\n\n${b}`);
        assert.ok(out.includes('424(b)'));
        assert.ok(out.includes('final prospectus'));
        assert.ok(/Securities Act\s+and\s+a\s+final/i.test(out));
    });
});
//# sourceMappingURL=merge-paragraph-glue.test.js.map