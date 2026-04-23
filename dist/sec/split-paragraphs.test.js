import assert from 'node:assert';
import { describe, it } from 'vitest';
import { splitIntoParagraphs } from './split-paragraphs.js';
describe('splitIntoParagraphs', () => {
    it('splits on blank lines and assigns sequential ids', () => {
        const section = {
            id: '9.01',
            title: 'Exhibits',
            type: 'section',
            text: 'First block.\n\nSecond block here.\n\nThird.',
            children: [],
        };
        const paras = splitIntoParagraphs(section);
        assert.strictEqual(paras.length, 3);
        assert.strictEqual(paras[0].id, '9.01.p1');
        assert.strictEqual(paras[2].id, '9.01.p3');
        assert.strictEqual(paras[0].type, 'paragraph');
        const joined = paras.map((p) => p.text).join('\n\n');
        assert.ok(joined.includes('First'));
        assert.ok(joined.includes('Third'));
    });
    it('fallback to single paragraph when no double newlines', () => {
        const section = {
            id: '3.02',
            title: 'Test',
            type: 'section',
            text: 'Only one paragraph without double breaks.',
            children: [],
        };
        const paras = splitIntoParagraphs(section);
        assert.strictEqual(paras.length, 1);
        assert.strictEqual(paras[0].id, '3.02.p1');
    });
});
//# sourceMappingURL=split-paragraphs.test.js.map