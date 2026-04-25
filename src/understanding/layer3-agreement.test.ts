import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ClauseBlock } from './normalized-clause.js';
import {
  buildAgreement,
  buildAgreements,
  computeRiskFlags,
  groupByAgreement,
  summarizeAgreement,
} from './layer3-agreement.js';
import { prepareLayer2ClausesForExport } from './layer2-clause-order.js';

const _dir = dirname(fileURLToPath(import.meta.url));

function baseClause(over: Partial<ClauseBlock> & Pick<ClauseBlock, 'clause_id'>): ClauseBlock {
  return {
    source_block_id: over.clause_id,
    source_paragraph_ids: [],
    event_ids: [],
    event_kinds: [],
    relationships: { governs: [], constrains: [], references: [] },
    priority: 'high',
    confidence: 0.9,
    clause_type: 'pricing_terms',
    primary_entity_id: 'org:issuer',
    counterparty_entity_ids: ['org:cp'],
    extracted_fields: {
      pricing: { mechanism: 'vwap_discount', settlement_method: 'VWAP' },
    },
    ...over,
  } as ClauseBlock;
}

describe('layer3 buildAgreements', () => {
  it('merges sample Layer 2 into one agreement (same primary + counterparties)', () => {
    const raw = readFileSync(join(_dir, 'fixtures/sample-layer2.json'), 'utf8');
    const clauses = prepareLayer2ClausesForExport(JSON.parse(raw) as ClauseBlock[]);
    const agreements = buildAgreements(clauses);
    expect(agreements).toHaveLength(1);
    const a = agreements[0]!;
    expect(a.clause_ids.length).toBe(clauses.length);
    expect(a.pricing?.mechanism).toBe('vwap_discount');
    expect(a.pricing?.discount_rate).toBe(0.03);
    expect(a.pricing?.has_variable_pricing).toBe(true);
    expect(a.constraints?.exchange_issuance_cap_rate).toBe(0.1999);
    expect(a.constraints?.beneficial_ownership_cap_rate).toBe(0.0499);
    expect(a.termination?.stated_term_months).toBe(24);
    expect(a.termination?.aggregate_purchase_ceiling_usd).toBe(50_000_000);
    expect(a.metadata.clause_count).toBe(5);
    expect(summarizeAgreement(a)).toContain('agrm_');
  });

  it('splits into two agreements when counterparty sets differ', () => {
    const a = baseClause({
      clause_id: 'a.p1',
      primary_entity_id: 'org:issuer',
      counterparty_entity_ids: ['org:cp1'],
    });
    const b = baseClause({
      clause_id: 'b.p1',
      primary_entity_id: 'org:issuer',
      counterparty_entity_ids: ['org:cp2'],
    });
    const out = buildAgreements([a, b]);
    expect(out).toHaveLength(2);
    const keys = new Set(out.map((x) => x.agreement_id));
    expect(keys.size).toBe(2);
  });

  it('detects pricing mechanism conflict and risk flags', () => {
    const c1 = baseClause({
      clause_id: 'x.block.0',
      extracted_fields: {
        pricing: {
          mechanism: 'vwap_discount',
          settlement_method: 'VWAP',
          discount_rate: 0.02,
        },
      },
    });
    const c2 = baseClause({
      clause_id: 'x.block.1',
      clause_type: 'pricing_terms',
      extracted_fields: {
        pricing: {
          mechanism: 'fixed_price',
          settlement_method: 'FIXED',
          discount_rate: 0.01,
        },
      },
    });
    const a = buildAgreement([c1, c2]);
    expect(a.metadata.conflicts.some((c) => c.domain === 'pricing')).toBe(true);
    const riskCodes = a.risk_flags.map((f) => f.code);
    expect(riskCodes).toContain('pricing_inconsistency');
  });

  it('groupByAgreement matches primary + sorted counterparties', () => {
    const a = baseClause({
      clause_id: '1',
      counterparty_entity_ids: ['org:b', 'org:a'],
    });
    const b = baseClause({
      clause_id: '2',
      counterparty_entity_ids: ['org:a', 'org:b'],
    });
    const g = groupByAgreement([a, b]);
    expect(g).toHaveLength(1);
  });

  it('computeRiskFlags surface discount threshold', () => {
    const a = buildAgreement([
      baseClause({
        clause_id: 'p1',
        extracted_fields: {
          pricing: {
            mechanism: 'vwap_discount',
            settlement_method: 'VWAP',
            discount_rate: 0.04,
          },
        },
      }),
    ]);
    expect(computeRiskFlags(a).map((f) => f.code)).toContain('purchase_discount_3pct_or_higher');
  });
});
