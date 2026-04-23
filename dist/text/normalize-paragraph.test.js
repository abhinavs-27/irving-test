import assert from 'node:assert';
import { describe, it } from 'vitest';
import { normalizeParagraphText } from './normalize-paragraph.js';
describe('normalizeParagraphText', () => {
    it('preserves \\n\\n between major breaks', () => {
        const t = normalizeParagraphText('First para line.\n\nSecond para.');
        assert.ok(t.includes('Second'));
        assert.ok(/\n\n/.test(t));
    });
    it('joins hyphenated PDF line wrap', () => {
        assert.strictEqual(normalizeParagraphText('part-\nword'), 'partword');
    });
    it('joins broken sentence lines with space inside one block', () => {
        const out = normalizeParagraphText('issued to it by the\nCompany under the Agreement.');
        assert.ok(out.includes('the Company'));
        assert.ok(!out.includes('the\nCompany'));
    });
});
//# sourceMappingURL=normalize-paragraph.test.js.map