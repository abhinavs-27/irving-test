import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import { agreementLifecycleChain, blocksLinkedToEntity } from './filing-graph.js';
import { checkCompleteness } from './filing-completeness.js';
import type { Layer1Filing } from './filing-types.js';
import {
  normalizeFactsDecimals,
  percentagePointsToDecimal,
} from './filing-normalize.js';
import { validateFiling, validateFilingRules } from './filing-validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSampleFiling(): Layer1Filing {
  const path = join(__dirname, 'fixtures/sample-filing.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as Layer1Filing;
}

describe('filing normalization', () => {
  it('maps percent points to decimals', () => {
    assert.strictEqual(percentagePointsToDecimal(19.99), 0.1999);
    assert.strictEqual(percentagePointsToDecimal(4.99), 0.0499);
  });

  it('adds percentage_decimals alongside percentages', () => {
    const f = normalizeFactsDecimals({
      percentages: [19.99, 4.99],
      dollar_amounts: [],
      share_counts: [],
      price_thresholds: [],
      dates: [],
      time_windows: [],
    });
    assert.deepStrictEqual(f.percentage_decimals, [0.1999, 0.0499]);
  });
});

describe('filing validation — negative cases', () => {
  it('fails when a paragraph is not in any block_registry entry', () => {
    const filing: Layer1Filing = {
      entity_registry: {
        'org:x': {
          kind: 'organization',
          canonical_name: 'X',
          aliases: [],
        },
      },
      block_registry: {
        's.block.0': {
          id: 's.block.0',
          type: 'structural',
          semantic_role: 'structural',
          paragraph_ids: ['s.p1'],
        },
      },
      events: [
        {
          id: 'event:test',
          kind: 'agreement_execution',
          label: 'x',
          primary_entity_id: 'org:x',
          counterparty_entity_ids: ['org:x'],
          agreement_types: [],
          source_block_ids: ['s.block.0'],
        },
      ],
      relationships: [{ type: 'governs', source: 's.block.0', target: 's.p1' }],
      sections: [
        {
          id: 's',
          type: 'section',
          children: [
            { id: 's.p1', type: 'paragraph', text: 'a', facts: {
              percentages: [], dollar_amounts: [], share_counts: [], price_thresholds: [], dates: [], time_windows: [],
            }},
            { id: 's.p2', type: 'paragraph', text: 'orphan', facts: {
              percentages: [], dollar_amounts: [], share_counts: [], price_thresholds: [], dates: [], time_windows: [],
            }},
          ],
        },
      ],
    };
    const r = validateFilingRules(filing);
    assert.ok(
      r.issues.some((i) => i.code === 'paragraph_unassigned'),
      `expected paragraph_unassigned, got ${JSON.stringify(r.issues)}`,
    );
  });

  it('fails when relationship points to unknown paragraph', () => {
    const filing: Layer1Filing = {
      entity_registry: {},
      block_registry: {
        b: {
          id: 'b',
          type: 'structural',
          semantic_role: 'structural',
          paragraph_ids: ['p1'],
        },
      },
      events: [],
      relationships: [{ type: 'governs', source: 'b', target: 'nosuch' }],
      sections: [],
    };
    const r = validateFilingRules(filing);
    assert.ok(r.issues.some((i) => i.code === 'relationship_bad_paragraph'));
  });

  it('fails when pricing_mechanism block lacks pricing_model', () => {
    const filing: Layer1Filing = {
      entity_registry: {},
      block_registry: {
        pb: {
          id: 'pb',
          type: 'pricing_mechanism',
          semantic_role: 'pricing',
          paragraph_ids: ['p1'],
        },
      },
      events: [],
      relationships: [],
      sections: [
        {
          id: 's',
          type: 'section',
          children: [
            {
              id: 'p1',
              type: 'paragraph',
              text: 'vwap',
              facts: {
                percentages: [],
                dollar_amounts: [],
                share_counts: [],
                price_thresholds: [],
                dates: [],
                time_windows: [],
              },
            },
          ],
        },
      ],
    };
    const r = validateFilingRules(filing);
    assert.ok(r.issues.some((i) => i.code === 'pricing_block_missing_model'));
  });
});

describe('filing validation — sample fixture', () => {
  it('validates full real JSON fixture (schema + rules)', () => {
    const filing = loadSampleFiling();
    const v = validateFiling(filing);
    assert.ok(
      v.ok,
      `fixture should validate: ${JSON.stringify(v.issues.slice(0, 15))}`,
    );
  });

  it('checkCompleteness passes on fixture', () => {
    const filing = loadSampleFiling();
    const r = checkCompleteness(filing);
    assert.ok(
      r.ok,
      `completeness: ${JSON.stringify(r.findings)}`,
    );
  });

  it('graph utilities run on fixture', () => {
    const filing = loadSampleFiling();
    const chain = agreementLifecycleChain(filing);
    assert.ok(chain.pricing_block_ids.length >= 0);
    const bl = blocksLinkedToEntity(
      filing,
      'org:b_riley_principal_capital_ii_llc',
    );
    assert.ok(Array.isArray(bl));
  });
});
