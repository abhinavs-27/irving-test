import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Layer1Filing } from '../src/layer1/filing-types.js';
import { DOMAIN_BY_CLAUSE_TYPE } from '../src/understanding/layer2-field-ownership.js';
import { LAYER2_CLAUSE_BLOCK_JSON_KEYS } from '../src/understanding/layer2-clause-order.js';
import { projectNormalizedClausesFromLayer1 } from '../src/understanding/layer2-from-layer1.js';
import type { ClauseBlock, TerminationSchema } from '../src/understanding/normalized-clause.js';
import { assertLayer2ClauseBlocks } from '../src/understanding/validate-layer2.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(_dir, '../src/understanding/fixtures');

const EXTRACTED_TOP = new Set([
  'pricing',
  'constraints',
  'termination',
  'disclosure',
  'structural',
  'obligations',
]);

function assertExtractedFieldsNoUnknownKeys(ef: object, path: string): void {
  for (const k of Object.keys(ef)) {
    expect(EXTRACTED_TOP.has(k), `${path}: unknown extracted_fields key "${k}"`).toBe(
      true,
    );
  }
}

function assertTerminationFlat(t: TerminationSchema, path: string): void {
  for (const [k, v] of Object.entries(t)) {
    if (v === undefined) continue;
    expect(
      typeof v === 'number' && Number.isFinite(v),
      `${path}: termination.${k} must be a number (no nesting)`,
    ).toBe(true);
  }
}

describe('Layer 2 schema lock', () => {
  it('projection is strict, flat, keyed, and single-domain (no cross-domain leakage)', () => {
    const raw = readFileSync(join(fixtureDir, 'sample-layer1.json'), 'utf8');
    const filing = JSON.parse(raw) as Layer1Filing;
    const clauses = projectNormalizedClausesFromLayer1(filing);

    expect(() => assertLayer2ClauseBlocks(clauses)).not.toThrow();

    for (const c of clauses) {
      expect(Object.keys(c)).toEqual([...LAYER2_CLAUSE_BLOCK_JSON_KEYS]);
      expect(c.extracted_fields).toBeDefined();
      const dom = DOMAIN_BY_CLAUSE_TYPE[c.clause_type];
      const keys = Object.keys(c.extracted_fields);
      if (c.clause_type === 'other') {
        expect(keys, c.clause_id).toEqual([]);
      } else if (dom !== undefined && keys.length > 0) {
        expect(keys, c.clause_id).toEqual([String(dom)]);
      }
      assertExtractedFieldsNoUnknownKeys(c.extracted_fields, c.clause_id);
      if (c.clause_type === 'structural' && c.extracted_fields.structural) {
        for (const k of Object.keys(c.extracted_fields.structural)) {
          expect(
            k === 'agreement_reference_date_iso' || k === 'execution_date_iso',
            `${c.clause_id}: structural must only carry date fields, got "${k}"`,
          ).toBe(true);
        }
      }
      if (c.extracted_fields.termination) {
        assertTerminationFlat(c.extracted_fields.termination, c.clause_id);
      }
    }

  });
});
