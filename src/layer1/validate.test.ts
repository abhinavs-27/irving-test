import assert from 'node:assert';
import { describe, it } from 'vitest';

import type { Clause } from '../clause/clause.js';

import { validateLayer1Tree } from './validate.js';

describe('validateLayer1Tree', () => {
  it('accepts a minimal structural tree', () => {
    const sections: Clause[] = [
      {
        id: '1.01',
        title: 'Item',
        text: '',
        type: 'section',
        children: [
          {
            id: '1.01.p1',
            title: '',
            text: 'Body.',
            type: 'paragraph',
            children: [],
            atomicKind: 'disclosure',
            facts: {
              percentages: [],
              dollar_amounts: [],
              share_counts: [],
              price_thresholds: [],
              dates: [],
              time_windows: [],
            },
            signals: {
              market_signals: { exchange: 'NYSE' },
              security_signals: {},
              legal_signals: {},
            },
          },
        ],
        blocks: [
          {
            id: '1.01.block.0',
            type: 'regulatory_disclosure',
            paragraph_ids: ['1.01.p1'],
          },
        ],
      },
    ];
    const r = validateLayer1Tree(sections);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.issues.length, 0);
  });

  it('flags legacy signals.market', () => {
    const sections: Clause[] = [
      {
        id: 'x',
        title: '',
        text: '',
        type: 'section',
        children: [
          {
            id: 'x.p1',
            title: '',
            text: '',
            type: 'paragraph',
            children: [],
            facts: {
              percentages: [],
              dollar_amounts: [],
              share_counts: [],
              price_thresholds: [],
              dates: [],
              time_windows: [],
            },
            signals: { market: { exchange: 'NYSE' } } as Clause['signals'],
          },
        ],
      },
    ];
    const r = validateLayer1Tree(sections as Clause[]);
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === 'signals_legacy_shape'));
  });
});
