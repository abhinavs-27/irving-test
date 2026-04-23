import type { BlockRegistryEntry } from './block-registry.js';
import type { Layer1Filing, FilingSectionNode } from './filing-types.js';
import type { GraphEvent, SectionConstraintEntry } from './types.js';
import { EVENT_ID_PREFIX } from './types.js';

export type AgreementLifecycle = {
  agreement_execution?: GraphEvent;
  agreement_termination?: GraphEvent;
  pricing_block_ids: string[];
  constraint_block_ids: string[];
  structural_block_ids: string[];
  termination_block_ids: string[];
  /** Ordered chain: execution (if any) → pricing blocks → constraint → termination (if any) */
  ordered_block_chain: string[];
};

function blocksBySemanticRole(
  block_registry: Record<string, BlockRegistryEntry>,
  role: BlockRegistryEntry['semantic_role'],
): string[] {
  return Object.entries(block_registry)
    .filter(([, b]) => b.semantic_role === role)
    .map(([id]) => id)
    .sort();
}

/** Entity → block ids that `defines` / `constrains` / `governs` (via paragraphs) touch the org. */
export function blocksLinkedToEntity(
  filing: Layer1Filing,
  entityId: string,
): string[] {
  const out = new Set<string>();
  for (const r of filing.relationships) {
    if (r.target !== entityId) continue;
    if (r.type === 'defines' || r.type === 'constrains') {
      out.add(r.source);
    }
  }
  for (const r of filing.relationships) {
    if (r.type !== 'governs') continue;
    const bid = r.source;
    const pid = r.target;
    const para = findParagraphNode(filing.sections, pid);
    const cid =
      para &&
      typeof para === 'object' &&
      para.signals &&
      typeof para.signals === 'object'
        ? (para.signals as { legal_signals?: { counterparty_id?: string } })
            .legal_signals?.counterparty_id
        : undefined;
    if (cid === entityId) {
      out.add(bid);
    }
  }
  return [...out].sort();
}

/** Paragraph ids in blocks that `defines`/`constrains` the entity, plus paragraphs citing `counterparty_id`. */
export function paragraphsLinkedToEntity(
  filing: Layer1Filing,
  entityId: string,
): string[] {
  const pids = new Set<string>();
  for (const r of filing.relationships) {
    if (
      (r.type === 'defines' || r.type === 'constrains') &&
      r.target === entityId
    ) {
      const b = filing.block_registry[r.source];
      if (b) {
        for (const pid of b.paragraph_ids) {
          pids.add(pid);
        }
      }
    }
  }
  for (const r of filing.relationships) {
    if (r.type !== 'governs') continue;
    const pid = r.target;
    const para = findParagraphNode(filing.sections, pid);
    const cid =
      para?.signals &&
      typeof para.signals === 'object' &&
      'legal_signals' in para.signals
        ? (para.signals as { legal_signals?: { counterparty_id?: string } })
            .legal_signals?.counterparty_id
        : undefined;
    if (cid === entityId) {
      pids.add(pid);
    }
  }
  return [...pids].sort();
}

function findParagraphNode(
  nodes: FilingSectionNode[] | undefined,
  id: string,
): FilingSectionNode | undefined {
  if (!nodes) return undefined;
  for (const n of nodes) {
    if (n.type === 'paragraph' && n.id === id) return n;
    const x = findParagraphNode(n.children, id);
    if (x) return x;
  }
  return undefined;
}

/** Events whose `source_block_ids` include `blockId`. */
export function eventsForBlock(
  filing: Layer1Filing,
  blockId: string,
): GraphEvent[] {
  return filing.events.filter((e) => e.source_block_ids.includes(blockId));
}

/** Events triggered by block via `triggers` relationship. */
export function eventsTriggeredByBlock(
  filing: Layer1Filing,
  blockId: string,
): GraphEvent[] {
  const ids = new Set<string>();
  for (const r of filing.relationships) {
    if (r.type === 'triggers' && r.source === blockId && r.target.startsWith(EVENT_ID_PREFIX)) {
      ids.add(r.target);
    }
  }
  return filing.events.filter((e) => ids.has(e.id));
}

/** All section-level constraint rows that mention `entityId` (counterparty or issuer heuristics). */
export function constraintsAffectingEntity(
  filing: Layer1Filing,
  entityId: string,
): SectionConstraintEntry[] {
  const out: SectionConstraintEntry[] = [];
  const walk = (nodes: FilingSectionNode[] | undefined): void => {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.constraints?.length) {
        for (const c of n.constraints) {
          const paras = c.source_paragraph_ids
            .map((pid) => findParagraphNode(filing.sections, pid))
            .filter(Boolean) as FilingSectionNode[];
          const hit = paras.some((p) => {
            const cid =
              p.signals &&
              typeof p.signals === 'object' &&
              'legal_signals' in p.signals
                ? (p.signals as { legal_signals?: { counterparty_id?: string } })
                    .legal_signals?.counterparty_id
                : undefined;
            return cid === entityId;
          });
          if (hit) out.push(c);
        }
      }
      walk(n.children);
    }
  };
  walk(filing.sections);
  return out;
}

/** Full agreement lifecycle summary for narrative Items (e.g. 1.01). */
export function agreementLifecycleChain(filing: Layer1Filing): AgreementLifecycle {
  const exec = filing.events.find((e) => e.kind === 'agreement_execution');
  const term = filing.events.find((e) => e.kind === 'agreement_termination');
  const pricing_block_ids = blocksBySemanticRole(
    filing.block_registry,
    'pricing',
  );
  const constraint_block_ids = blocksBySemanticRole(
    filing.block_registry,
    'constraint',
  );
  const structural_block_ids = blocksBySemanticRole(
    filing.block_registry,
    'structural',
  );
  const termination_block_ids = blocksBySemanticRole(
    filing.block_registry,
    'termination',
  );

  const ordered_block_chain: string[] = [];
  if (exec?.source_block_ids[0]) {
    ordered_block_chain.push(exec.source_block_ids[0]!);
  }
  ordered_block_chain.push(...pricing_block_ids);
  ordered_block_chain.push(...constraint_block_ids);
  ordered_block_chain.push(...termination_block_ids);

  return {
    agreement_execution: exec,
    agreement_termination: term,
    pricing_block_ids,
    constraint_block_ids,
    structural_block_ids,
    termination_block_ids,
    ordered_block_chain: [...new Set(ordered_block_chain)],
  };
}
