import type { Clause } from '../clause/clause.js';
import type { BlockRegistryEntry } from './block-registry.js';
import type { DocumentRelationship, GraphEvent } from './types.js';
import {
  B_RILEY_PRINCIPAL_ID,
  resolveIssuerEntityId,
} from './entity-registry.js';
import { extractExplicitClausePricing } from './explicit-pricing.js';
import { atomicKindForLayer1BlockType, type Layer1BlockType } from './types.js';
import type { Layer1GraphPayload } from './layer1-graph-compile.js';

function dedupeEdges(relationships: DocumentRelationship[]): void {
  const seen = new Set<string>();
  const out: DocumentRelationship[] = [];
  for (const r of relationships) {
    const k = `${r.type}|${r.source}|${r.target}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  relationships.length = 0;
  relationships.push(...out);
}

/**
 * Contract: when `pricing_model` is present, it must include `method: VWAP` and full modes.
 * Drops `pricing_model` if discount cannot be resolved for all modes.
 */
export function finalizePricingInBlockRegistry(
  block_registry: Record<string, BlockRegistryEntry>,
  sections: Clause[],
): void {
  const paraMap = new Map<string, Clause>();
  const walk = (nodes: Clause[]): void => {
    for (const n of nodes) {
      if (n.type === 'paragraph') paraMap.set(n.id, n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(sections);

  for (const [bid, br] of Object.entries(block_registry)) {
    if (!br.pricing_model) continue;
    const paras = br.paragraph_ids.map((id) => paraMap.get(id)).filter(Boolean) as Clause[];
    const combined = paras.map((p) => p.text).join('\n');
    const disc = extractExplicitClausePricing(combined)?.discount_rate;
    const pm = br.pricing_model;
    const modes = pm.modes.map((m) => ({
      ...m,
      discount_percent:
        m.discount_percent ??
        disc ??
        pm.modes.find((x) => x.discount_percent != null)?.discount_percent,
    }));
    const ok =
      modes.length > 0 &&
      modes.every(
        (m) =>
          m.discount_percent != null &&
          Number.isFinite(m.discount_percent) &&
          Boolean(m.vwap_window),
      );
    if (ok) {
      block_registry[bid] = {
        ...br,
        pricing_model: {
          type: 'vwap_discount',
          method: 'VWAP',
          modes,
        },
      };
    } else {
      const { pricing_model: _p, ...rest } = br;
      block_registry[bid] = rest as BlockRegistryEntry;
    }
  }
}

export function enrichTerminationEvents(events: GraphEvent[], sections: Clause[]): void {
  const paraMap = new Map<string, Clause>();
  const walk = (nodes: Clause[]): void => {
    for (const n of nodes) {
      if (n.type === 'paragraph') paraMap.set(n.id, n);
      if (n.children.length) walk(n.children);
    }
  };
  walk(sections);

  for (const ev of events) {
    if (ev.kind !== 'agreement_termination') continue;
    const pids = ev.source_block_ids.flatMap((bid) => {
      const s = sections.find((x) => x.blocks?.some((b) => b.id === bid));
      const b = s?.blocks?.find((bl) => bl.id === bid);
      return b?.paragraph_ids ?? [];
    });
    const texts = pids
      .map((id) => paraMap.get(id)?.text)
      .filter(Boolean) as string[];
    const merged = texts.join('\n').replace(/\s+/g, ' ').trim();
    if (merged.length >= 40) {
      ev.label = merged.slice(0, 420);
    }
    const dates: string[] = [];
    for (const id of pids) {
      const d = paraMap.get(id)?.facts?.dates;
      if (d?.length) dates.push(...d);
    }
    if (dates.length && !ev.as_of_date) {
      dates.sort();
      ev.as_of_date = dates[0];
    }
  }
}

export function ensureParagraphAtomicKinds(sections: Clause[]): void {
  for (const s of sections) {
    if (!s.blocks?.length) continue;
    const map = new Map<string, ReturnType<typeof atomicKindForLayer1BlockType>>();
    for (const b of s.blocks) {
      const ak = atomicKindForLayer1BlockType(b.type as Layer1BlockType);
      for (const pid of b.paragraph_ids) {
        map.set(pid, ak);
      }
    }
    s.children = s.children.map((ch) => {
      if (ch.type !== 'paragraph') return ch;
      const ak = map.get(ch.id);
      if (ak != null && ch.atomicKind == null) {
        return { ...ch, atomicKind: ak };
      }
      return ch;
    });
  }
}

export function augmentConstraintParagraphFacts(sections: Clause[]): void {
  for (const s of sections) {
    if (s.type !== 'section' || !s.blocks) continue;
    const cb = s.blocks.find((b) => b.type === 'constraint');
    if (!cb) continue;
    for (const pid of cb.paragraph_ids) {
      const p = s.children.find((c) => c.id === pid && c.type === 'paragraph');
      if (!p?.facts) continue;
      const t = p.text;
      const pct: number[] = [...p.facts.percentages];
      const add = (n: number): void => {
        if (!pct.some((x) => Math.abs(x - n) < 0.02)) pct.push(n);
      };
      if (/\b19\.99\b/.test(t)) add(19.99);
      if (/\b4\.99\b/.test(t)) add(4.99);
      if (pct.length !== p.facts.percentages.length) {
        p.facts = { ...p.facts, percentages: pct };
      }
    }
  }
}

export function ensureRelationshipCompleteness(
  payload: Layer1GraphPayload,
  sections: Clause[],
): void {
  const { block_registry, events, relationships, entity_registry } = payload;
  const issuerId = resolveIssuerEntityId(sections, entity_registry);
  const cp =
    B_RILEY_PRINCIPAL_ID in entity_registry ? B_RILEY_PRINCIPAL_ID : undefined;

  for (const [bid, br] of Object.entries(block_registry)) {
    for (const pid of br.paragraph_ids) {
      const has = relationships.some(
        (r) => r.type === 'governs' && r.source === bid && r.target === pid,
      );
      if (!has) {
        relationships.push({ type: 'governs', source: bid, target: pid });
      }
    }
    if (br.semantic_role === 'constraint') {
      if (issuerId) {
        relationships.push({
          type: 'constrains',
          source: bid,
          target: issuerId,
        });
      }
      if (cp && cp !== issuerId) {
        relationships.push({ type: 'constrains', source: bid, target: cp });
      }
    }
    if (br.semantic_role === 'termination') {
      const ev = events.find(
        (e) =>
          e.kind === 'agreement_termination' &&
          e.source_block_ids.includes(bid),
      );
      if (ev) {
        const hasT = relationships.some(
          (r) =>
            r.type === 'triggers' && r.source === bid && r.target === ev.id,
        );
        if (!hasT) {
          relationships.push({
            type: 'triggers',
            source: bid,
            target: ev.id,
          });
        }
      }
    }
  }

  const exec = events.find((e) => e.kind === 'agreement_execution');
  if (exec?.source_block_ids[0]) {
    const has = relationships.some(
      (r) =>
        r.type === 'triggers' &&
        r.source === exec.source_block_ids[0] &&
        r.target === exec.id,
    );
    if (!has) {
      relationships.push({
        type: 'triggers',
        source: exec.source_block_ids[0]!,
        target: exec.id,
      });
    }
  }

  dedupeEdges(relationships);
}

export function applyExtractionContractFixes(
  sections: Clause[],
  payload: Layer1GraphPayload,
): void {
  augmentConstraintParagraphFacts(sections);
  ensureParagraphAtomicKinds(sections);
  finalizePricingInBlockRegistry(payload.block_registry, sections);
  enrichTerminationEvents(payload.events, sections);
  ensureRelationshipCompleteness(payload, sections);
}
