import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLayer1FilingInput, projectNormalizedClausesFromLayer1, } from './layer2-from-layer1.js';
import { prepareLayer2ClausesForExport } from './layer2-clause-order.js';
import { assertLayer2ClauseBlock, assertLayer2ClauseBlocks, } from './validate-layer2.js';
const _dir = dirname(fileURLToPath(import.meta.url));
describe('projectNormalizedClausesFromLayer1', () => {
    it('maps block.type → clause_type and uses block id as clause_id (sample filing)', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8');
        const filing = JSON.parse(raw);
        const clauses = projectNormalizedClausesFromLayer1(filing);
        const pricing = clauses.find((c) => c.clause_id === '1.01.block.1');
        assert.ok(pricing);
        assert.strictEqual(pricing.clause_type, 'pricing_terms');
        assert.strictEqual(pricing.source_block_id, '1.01.block.1');
        assert.deepStrictEqual(pricing.source_paragraph_ids, [
            '1.01.p2',
            '1.01.p3',
            '1.01.p4',
            '1.01.p7',
        ]);
        const p = pricing.extracted_fields.pricing;
        assert.ok(p);
        assert.strictEqual(p.mechanism, 'vwap_discount');
        assert.strictEqual(p.settlement_method, 'VWAP');
        assert.ok((p.modes?.length ?? 0) >= 1);
        assert.strictEqual(p.discount_rate, 0.03);
        assert.strictEqual(p.modes[0].discount_rate, 0.03);
        assert.strictEqual(pricing.primary_entity_id, 'org:gelesis_holdings_inc');
        assert.doesNotThrow(() => assertLayer2ClauseBlock(pricing));
        assert.ok(pricing.counterparty_entity_ids.includes('org:b_riley_principal_capital_ii_llc'));
        assert.strictEqual(pricing.priority, 'high');
    });
    it('links triggers relationships to event_ids and event_kinds', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8');
        const filing = JSON.parse(raw);
        const clauses = projectNormalizedClausesFromLayer1(filing);
        const term = clauses.find((c) => c.clause_id === '1.01.block.3');
        assert.ok(term);
        assert.strictEqual(term.clause_type, 'termination');
        assert.ok(term.event_ids.includes('event:termination_1_01_block_3'));
        assert.ok(term.event_kinds.includes('agreement_termination'));
    });
    it('assigns structural blocks low priority (deterministic from clause_type only)', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8');
        const filing = JSON.parse(raw);
        const clauses = projectNormalizedClausesFromLayer1(filing);
        const structural = clauses.filter((c) => c.clause_type === 'structural');
        assert.ok(structural.length >= 1);
        for (const s of structural) {
            assert.strictEqual(s.priority, 'low');
        }
    });
    it('does not allow cross-domain leakage', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8');
        const filing = JSON.parse(raw);
        const clauses = projectNormalizedClausesFromLayer1(filing);
        for (const c of clauses) {
            if (c.clause_type === 'structural' && c.extracted_fields.structural) {
                expect(c.extracted_fields.structural).not.toHaveProperty('stated_term_months');
                expect(c.extracted_fields.structural).not.toHaveProperty('commitment_ceiling_usd');
            }
        }
    });
    it('returns one clause per block (deduped by construction)', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8');
        const filing = JSON.parse(raw);
        const clauses = projectNormalizedClausesFromLayer1(filing);
        const ids = Object.keys(filing.block_registry).sort();
        assert.strictEqual(clauses.length, ids.length);
        const clauseIds = new Set(clauses.map((c) => c.clause_id));
        assert.strictEqual(clauseIds.size, clauses.length);
    });
    it('buildLayer1FilingInput mirrors analyze wiring', () => {
        const filingJson = JSON.parse(readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8'));
        const input = buildLayer1FilingInput({
            entity_registry: filingJson.entity_registry,
            block_registry: filingJson.block_registry,
            events: filingJson.events,
            relationships: filingJson.relationships,
            sections: filingJson.sections ?? [],
        });
        const out = projectNormalizedClausesFromLayer1(input);
        assert.ok(out.length >= 5);
    });
    it('matches Layer 2 v2 snapshot (sample-layer1 → projection)', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer1.json'), 'utf8');
        const filing = JSON.parse(raw);
        const clauses = projectNormalizedClausesFromLayer1(filing);
        expect(clauses).toMatchSnapshot();
    });
    it('sample-layer2.json fixture conforms to strict v2 validation', () => {
        const raw = readFileSync(join(_dir, 'fixtures/sample-layer2.json'), 'utf8');
        const clauses = prepareLayer2ClausesForExport(JSON.parse(raw));
        expect(() => assertLayer2ClauseBlocks(clauses)).not.toThrow();
    });
});
//# sourceMappingURL=layer2-from-layer1.test.js.map