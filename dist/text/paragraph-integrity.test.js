import assert from 'node:assert';
import { describe, it } from 'vitest';
import { mergeIncompleteParagraphs, paragraphEndsIncomplete, } from './paragraph-integrity.js';
function para(id, text) {
    return {
        id,
        title: '',
        text,
        type: 'paragraph',
        children: [],
    };
}
describe('paragraph integrity', () => {
    it('detects dangling articles and prepositions', () => {
        assert.strictEqual(paragraphEndsIncomplete('issued to it by the'), true);
        assert.strictEqual(paragraphEndsIncomplete('Full sentence here.'), false);
    });
    it('merges incomplete fragments and renumbers ids', () => {
        const merged = mergeIncompleteParagraphs('1.01', [
            para('1.01.p1', 'issued to it by the'),
            para('1.01.p2', 'Company pursuant to Section 2.'),
        ]);
        assert.strictEqual(merged.length, 1);
        assert.strictEqual(merged[0].text, 'issued to it by the Company pursuant to Section 2.');
        assert.strictEqual(merged[0].id, '1.01.p1');
    });
});
//# sourceMappingURL=paragraph-integrity.test.js.map