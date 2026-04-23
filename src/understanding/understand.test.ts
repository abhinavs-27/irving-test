import assert from 'node:assert';
import { describe, it } from 'vitest';

import type { Clause } from '../clause/clause.js';

import { understandAtomicClause, understandDocument } from './understand.js';

describe('understandAtomicClause', () => {
  it('does not force misc.noise for header.* when text has legal/VWAP semantics', () => {
    const p: Clause = {
      id: 'header.p1',
      title: '',
      text:
        'The Purchase Price shall mean VWAP over five trading days with a three percent discount applied to VWAP.',
      type: 'paragraph',
      children: [],
    };
    const row = understandAtomicClause(p);
    assert.ok(row);
    assert.strictEqual(row!.clause_type, 'pricing_terms');
    assert.ok(row!.semantic_block_id.startsWith('header.'));
    assert.ok(row!.debug);
    assert.strictEqual(row!.debug.merged_with.length, 0);
  });

  it('classifies thin navigation-only Item lines as misc.noise', () => {
    const p: Clause = {
      id: '1.01.p9',
      title: '',
      text: 'Item 1.01',
      type: 'paragraph',
      children: [],
    };
    const row = understandAtomicClause(p);
    assert.ok(row);
    assert.strictEqual(row!.clause_type, 'misc.noise');
    assert.ok(row!.debug.why_classified_as_noise);
  });

  it('returns exactly one record with strict schema fields', () => {
    const p: Clause = {
      id: '1.01.p5',
      title: '',
      text: 'Either party may terminate this agreement with 10 days advance notice for convenience.',
      type: 'paragraph',
      children: [],
    };
    const row = understandAtomicClause(p);
    assert.ok(row);
    assert.strictEqual(row!.clause_id, '1.01.p5');
    assert.strictEqual(typeof row!.primary_intent, 'string');
    assert.ok(!('summary' in row!));
    assert.strictEqual(typeof row!.confidence, 'number');
    assert.ok(row!.confidence >= 0 && row!.confidence <= 1);
    assert.strictEqual(typeof row!.semantic_block_id, 'string');
    assert.ok(row!.debug);
  });
});

describe('understandDocument', () => {
  it('returns one object per clause_id and valid JSON', () => {
    const sections: Clause[] = [
      {
        id: '1.01',
        title: 'Test',
        type: 'section',
        text: 'Body',
        children: [
          {
            id: '1.01.p1',
            title: '',
            text: 'The Purchase Price shall mean VWAP over five trading days.',
            type: 'paragraph',
            children: [],
          },
          {
            id: '1.01.p1',
            title: '',
            text: 'Duplicate id should be skipped in document pass.',
            type: 'paragraph',
            children: [],
          },
        ],
      },
    ];
    const out = understandDocument(sections);
    JSON.stringify(out);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0]!.clause_id, '1.01.p1');
    assert.ok(out[0]!.semantic_block_id.includes('.sb'));
    assert.ok(out[0]!.debug.block_assignment_reason);
  });
});
