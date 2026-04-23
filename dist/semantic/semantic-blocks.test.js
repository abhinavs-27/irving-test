import assert from 'node:assert';
import { describe, it } from 'vitest';
import { groupParagraphsIntoBlocks } from './semantic-blocks.js';
describe('groupParagraphsIntoBlocks', () => {
    it('partitions paragraphs into sequential blocks without dropping nodes', () => {
        const paras = [
            {
                id: '1.01.p1',
                title: '',
                text: 'Introductory overview.',
                type: 'paragraph',
                children: [],
            },
            {
                id: '1.01.p2',
                title: '',
                text: 'The Purchase Price shall be calculated using VWAP payment proceeds.',
                type: 'paragraph',
                children: [],
            },
            {
                id: '1.01.p3',
                title: '',
                text: 'Either party may terminate this agreement upon expiration.',
                type: 'paragraph',
                children: [],
            },
        ];
        const blocks = groupParagraphsIntoBlocks({
            id: '1.01',
            title: '',
            text: '',
            type: 'section',
            children: [],
        }, paras);
        const allIds = new Set(paras.map((p) => p.id));
        const fromBlocks = blocks.flatMap((b) => b.paragraph_ids);
        assert.strictEqual(fromBlocks.length, paras.length);
        for (const id of fromBlocks)
            assert.ok(allIds.has(id));
        assert.ok(blocks.length >= 1);
        assert.ok(blocks.every((b) => b.id.startsWith('1.01.block.')));
    });
});
//# sourceMappingURL=semantic-blocks.test.js.map