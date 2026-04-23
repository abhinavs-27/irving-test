import type { Clause } from '../clause/clause.js';
import type { DocumentRelationship, EntityRegistry } from './types.js';
import {
  B_RILEY_PRINCIPAL_ID,
  resolveIssuerEntityId,
} from './entity-registry.js';

function firstParagraphIdInItems(sections: Clause[], itemId: string): string | null {
  const s = sections.find((x) => x.id === itemId && x.type === 'section');
  const p = s?.children.find((c) => c.type === 'paragraph');
  return p ? p.id : null;
}

function findBlockIdForParagraph(
  sec: Clause,
  paraId: string,
): string | null {
  if (!sec.blocks) return null;
  for (const b of sec.blocks) {
    if (b.paragraph_ids.includes(paraId)) return b.id;
  }
  return null;
}

function counterpartyOrgId(r: EntityRegistry): string | undefined {
  if (r[B_RILEY_PRINCIPAL_ID]) {
    return B_RILEY_PRINCIPAL_ID;
  }
  return Object.keys(r).find((k) => k.startsWith('org:'));
}

export type BuildRelationshipsContext = {
  entityRegistry: EntityRegistry;
  eventIdByBlock: ReadonlyMap<string, string>;
};

/**
 * Block → paragraph (`governs`), block → entity (`defines` / `constrains`), block → event (`triggers`).
 */
export function buildDocumentRelationships(
  sections: Clause[],
  ctx: BuildRelationshipsContext,
): { relationships: DocumentRelationship[] } {
  const { entityRegistry, eventIdByBlock } = ctx;
  const out: DocumentRelationship[] = [];
  const seen = new Set<string>();
  const add = (r: DocumentRelationship): void => {
    const k = `${r.type}|${r.source}|${r.target}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  };

  const issuerId = resolveIssuerEntityId(sections, entityRegistry);
  const cp = counterpartyOrgId(entityRegistry);

  for (const sec of sections) {
    if (sec.type !== 'section' || !sec.blocks?.length) continue;

    const byType = (ty: string) => sec.blocks!.find((b) => b.type === ty);

    const pm = byType('pricing_mechanism');
    const cst = byType('constraint');
    const term = byType('termination');

    const inBlock = (b: { paragraph_ids: string[] }, id: string): boolean =>
      b.paragraph_ids.includes(id);

    if (pm) {
      if (cp) {
        add({ type: 'defines', source: pm.id, target: cp });
      }
      for (const ch of sec.children) {
        if (ch.type !== 'paragraph' || !inBlock(pm, ch.id)) {
          continue;
        }
        add({ type: 'governs', source: pm.id, target: ch.id });
      }
    }

    if (cst) {
      for (const ch of sec.children) {
        if (ch.type !== 'paragraph' || !inBlock(cst, ch.id)) {
          continue;
        }
        add({ type: 'governs', source: cst.id, target: ch.id });
      }
      if (issuerId) {
        add({ type: 'constrains', source: cst.id, target: issuerId });
      }
      if (cp && cp !== issuerId) {
        add({ type: 'constrains', source: cst.id, target: cp });
      }
    }

    if (term) {
      for (const ch of sec.children) {
        if (ch.type === 'paragraph' && term.paragraph_ids.includes(ch.id)) {
          add({ type: 'governs', source: term.id, target: ch.id });
        }
      }
      const ev = eventIdByBlock.get(term.id);
      if (ev) {
        add({ type: 'triggers', source: term.id, target: ev });
      }
    }
  }

  const p101 = firstParagraphIdInItems(sections, '1.01');
  if (p101) {
    for (const s of sections) {
      if (s.type !== 'section' || s.id === '1.01' || !s.blocks?.length) {
        continue;
      }
      for (const p of s.children) {
        if (p.type !== 'paragraph') continue;
        if (
          !/Item\s+1\.01|furnish(?:ed|ing|es)?\s+.*Item\s*1\.01|pursuant\s+to\s+Item\s*1\.01|described.*Item\s*1\.01|under\s+Item\s*1\.01|reported\s+.*Item\s*1\.01|dated\s+.*Item\s*1\.01|disclosed.*Item\s*1\.01/i.test(
            p.text,
          )
        ) {
          continue;
        }
        const src = findBlockIdForParagraph(s, p.id);
        if (src) {
          add({ type: 'references', source: src, target: p101 });
        }
      }
    }
  }

  return { relationships: out };
}
