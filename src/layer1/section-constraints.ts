import type { Clause } from '../clause/clause.js';
import type { SectionConstraintEntry } from './types.js';
import { buildNormalizedFactsForParagraph } from './facts-pipeline.js';

let seq = 0;
function nextId(sectionId: string, kind: string): string {
  seq += 1;
  return `constraint:${sectionId}:${kind}:${seq}`;
}

function hasPctInText(t: string, n: '4.99' | '19.99'): boolean {
  if (n === '4.99') {
    return /\b4\.99\s*%?\b/i.test(t);
  }
  return /\b19\.99\s*%?\b/i.test(t);
}

/**
 * 19.99% → `exchange_issuance_cap`. 4.99% → `beneficial_ownership_cap`.
 * Keyword fallbacks when % not normalized into facts.
 */
export function buildSectionConstraints(section: Clause): SectionConstraintEntry[] {
  if (section.type !== 'section' || !section.blocks?.length) return [];

  const byId = new Map(section.children.map((c) => [c.id, c]));
  const out: SectionConstraintEntry[] = [];

  for (const b of section.blocks) {
    if (b.type !== 'constraint') continue;
    for (const pid of b.paragraph_ids) {
      const p = byId.get(pid);
      if (p?.type !== 'paragraph') continue;
      const t = p.text;
      const facts = p.facts ?? buildNormalizedFactsForParagraph(t);
      const pcts = facts.percentages;
      const has1999 =
        hasPctInText(t, '19.99') ||
        pcts.some((x) => Math.abs(x - 19.99) < 0.01);
      const has499 =
        hasPctInText(t, '4.99') ||
        pcts.some((x) => Math.abs(x - 4.99) < 0.01);

      if (has1999) {
        out.push({
          id: nextId(section.id, 'exch'),
          kind: 'exchange_issuance_cap',
          source_paragraph_ids: [pid],
          source_block_id: b.id,
          description:
            'Stated 19.99% cap (exchange / issuance), as in the paragraph',
          values: {
            share_cap: facts.share_counts[0],
            percentages: pcts,
            dollar_cap: facts.dollar_amounts[0],
          },
        });
      }
      if (has499) {
        out.push({
          id: nextId(section.id, 'bo'),
          kind: 'beneficial_ownership_cap',
          source_paragraph_ids: [pid],
          source_block_id: b.id,
          description:
            'Stated 4.99% cap (beneficial / aggregate ownership), as in the paragraph',
          values: { percentages: pcts },
        });
      }
      if (has1999 || has499) {
        continue;
      }

      if (/\bExchange\s+Cap|exchange cap|aggregate.*shares.*(?:exchange|list)/i.test(t)) {
        out.push({
          id: nextId(section.id, 'exch_kw'),
          kind: 'exchange_issuance_cap',
          source_paragraph_ids: [pid],
          source_block_id: b.id,
          description: 'Exchange or aggregate issuance cap (keyword-only cue)',
          values: {
            share_cap: facts.share_counts[0],
            percentages: pcts,
            dollar_cap: facts.dollar_amounts[0],
          },
        });
      } else if (/\bbeneficially|beneficial owner|aggregate.*ownership/i.test(t)) {
        out.push({
          id: nextId(section.id, 'bo_kw'),
          kind: 'beneficial_ownership_cap',
          source_paragraph_ids: [pid],
          source_block_id: b.id,
          description: 'Beneficial or aggregate ownership cap (keyword-only cue)',
          values: { percentages: pcts },
        });
      }
    }
  }

  const byMerge = new Map<string, SectionConstraintEntry>();
  for (const c of out) {
    const k = `${c.kind}|${[...c.source_paragraph_ids].sort().join(',')}`;
    if (!byMerge.has(k)) byMerge.set(k, c);
  }
  return [...byMerge.values()];
}
