import assert from 'node:assert';
import { describe, it } from 'vitest';

import { extractSections } from './extract-sections.js';
import { segmentSectionsIntoParagraphs } from './split-paragraphs.js';

const SEC_SAMPLE = `
UNITED STATES
SECURITIES AND EXCHANGE COMMISSION

Item 1.01 Entry into a Material Definitive Agreement

Details about the agreement.

Item 3.02 Unregistered Sales of Equity Securities

Sales disclosure.

Item 9.01 Financial Statements and Exhibits

Exhibit list.

Pursuant to the requirements of the Securities Exchange Act of 1934

SIGNATURE

By: /s/ Jane Doe
`;

describe('extractSections (SEC)', () => {
  it('splits metadata, Items, and footer; titles only from Item lines', () => {
    const segs = segmentSectionsIntoParagraphs(extractSections(SEC_SAMPLE));

    const header = segs.find((s) => s.id === 'header');
    const i101 = segs.find((s) => s.id === '1.01');
    const i302 = segs.find((s) => s.id === '3.02');
    const i901 = segs.find((s) => s.id === '9.01');
    const footer = segs.find((s) => s.id === 'signature');

    assert.ok(header && header.type === 'metadata');
    assert.strictEqual(header!.text, '');
    assert.ok(header!.filingHeader);

    assert.ok(i101 && i101.type === 'section');
    assert.strictEqual(i101!.title, 'Entry into a Material Definitive Agreement');
    assert.strictEqual(i101!.text, '');
    assert.ok((i101!.children?.length ?? 0) >= 1);
    assert.strictEqual(i101!.children[0]?.type, 'paragraph');
    assert.ok(i101!.children[0]?.id.startsWith('1.01.p'));
    assert.ok(i101!.children.some((p) => p.text.includes('Details about')));

    assert.ok(i302 && i302.title.includes('Unregistered'));

    assert.strictEqual(i901!.text, '');
    assert.ok(i901!.children.some((p) => p.text.includes('Exhibit')));

    assert.ok(footer && footer.type === 'footer');
    assert.strictEqual(footer!.text, '');
    assert.ok(
      footer!.children.some((p) =>
        /SIGNATURE|Pursuant/i.test(p.text),
      ),
    );

    assert.ok(segs.some((s) => s.type === 'section' && s.children.length > 0));
  });
});
