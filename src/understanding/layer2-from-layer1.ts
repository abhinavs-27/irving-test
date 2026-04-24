import type { Clause } from '../clause/clause.js';
import type { Layer1Filing, FilingSectionNode } from '../layer1/filing-types.js';
import type { BlockRegistryEntry } from '../layer1/block-registry.js';
import type {
  DocumentRelationship,
  EntityRegistry,
  FactsV2,
  GraphEvent,
  Layer1BlockType,
  SectionConstraintEntry,
} from '../layer1/types.js';
import { ENTITY_ID_PREFIX, EVENT_ID_PREFIX } from '../layer1/types.js';
import { resolveIssuerEntityId } from '../layer1/entity-registry.js';
import { buildSectionConstraints } from '../layer1/section-constraints.js';
import { buildExtractedFieldsForBlock } from './layer2-extracted-build.js';
import { mergeFacts } from './layer2-normalize.js';
import { mergeTerminationDomainIntoCanonical } from './layer2-canonical-merge.js';
import { PRIORITY_BY_TYPE } from './layer2-field-ownership.js';
import { prepareLayer2ClauseForExport } from './layer2-clause-order.js';
import { assertLayer2ClauseBlocks } from './validate-layer2.js';
import type {
  ExtractedFields,
  NormalizedClauseRecord,
  NormalizedClauseType,
} from './normalized-clause.js';

function layer1BlockTypeToClauseType(t: Layer1BlockType): NormalizedClauseType {
  switch (t) {
    case 'pricing_mechanism':
      return 'pricing_terms';
    case 'constraint':
      return 'constraint';
    case 'termination':
      return 'termination';
    case 'regulatory_disclosure':
      return 'disclosure';
    case 'structural':
      return 'structural';
    default: {
      const _e: never = t;
      return _e;
    }
  }
}

/** Structural blocks: cap confidence unless multiple strong signals (see spec). */
function applyStructuralConfidenceCap(
  clauseType: NormalizedClauseType,
  confidence: number,
  linkedEventsCount: number,
  extracted: ExtractedFields,
): number {
  if (clauseType !== 'structural') return confidence;
  const s = extracted.structural;
  const hasBothDates =
    !!s?.agreement_reference_date_iso &&
    !!s?.execution_date_iso &&
    s.agreement_reference_date_iso.trim() !== '' &&
    s.execution_date_iso.trim() !== '';
  const enriched = linkedEventsCount >= 2 || (linkedEventsCount >= 1 && hasBothDates);
  if (enriched) return Math.min(0.96, confidence);
  return Math.min(0.6, confidence);
}

function collectParagraphMap(
  roots: FilingSectionNode[],
): Map<string, FilingSectionNode> {
  const m = new Map<string, FilingSectionNode>();
  const walk = (n: FilingSectionNode): void => {
    if (n.type === 'paragraph') m.set(n.id, n);
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of roots) walk(r);
  return m;
}

function collectAllSectionConstraints(
  roots: FilingSectionNode[],
): SectionConstraintEntry[] {
  const out: SectionConstraintEntry[] = [];
  const walk = (n: FilingSectionNode): void => {
    if (n.type === 'section') {
      if (n.constraints?.length) {
        out.push(...n.constraints);
      } else {
        out.push(...buildSectionConstraints(n as unknown as Clause));
      }
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}

function constraintsForBlock(
  block: BlockRegistryEntry,
  all: SectionConstraintEntry[],
): SectionConstraintEntry[] {
  const pset = new Set(block.paragraph_ids);
  return all.filter(
    (c) =>
      c.source_block_id === block.id ||
      c.source_paragraph_ids.some((pid) => pset.has(pid)),
  );
}

function sliceRelationships(
  blockId: string,
  relationships: DocumentRelationship[],
): NormalizedClauseRecord['relationships'] {
  const governs: string[] = [];
  const constrains: string[] = [];
  const references: string[] = [];
  for (const r of relationships) {
    if (r.source !== blockId) continue;
    if (r.type === 'governs') governs.push(r.target);
    else if (r.type === 'constrains' && r.target.startsWith(ENTITY_ID_PREFIX)) {
      constrains.push(r.target);
    } else if (r.type === 'references') references.push(r.target);
  }
  return {
    governs: [...new Set(governs)].sort(),
    constrains: [...new Set(constrains)].sort(),
    references: [...new Set(references)].sort(),
  };
}

function linkedEventsForBlock(
  blockId: string,
  events: GraphEvent[],
  relationships: DocumentRelationship[],
): GraphEvent[] {
  const byId = new Map(events.map((e) => [e.id, e] as const));
  const out = new Map<string, GraphEvent>();
  for (const e of events) {
    if (e.source_block_ids.includes(blockId)) out.set(e.id, e);
  }
  for (const r of relationships) {
    if (
      r.source === blockId &&
      r.type === 'triggers' &&
      r.target.startsWith(EVENT_ID_PREFIX)
    ) {
      const e = byId.get(r.target);
      if (e) out.set(e.id, e);
    }
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function paragraphCounterpartyHints(
  block: BlockRegistryEntry,
  paraById: Map<string, FilingSectionNode>,
): string[] {
  const ids = new Set<string>();
  for (const pid of block.paragraph_ids) {
    const p = paraById.get(pid);
    const cid = p?.signals?.legal_signals?.counterparty_id;
    if (cid && cid.startsWith(ENTITY_ID_PREFIX)) ids.add(cid);
  }
  return [...ids].sort();
}

function resolveClauseEntities(
  blockId: string,
  linked: GraphEvent[],
  relationships: DocumentRelationship[],
  issuerId: string | undefined,
  paraCpIds: string[],
): { primary_entity_id: string | null; counterparty_entity_ids: string[] } {
  if (linked.length > 0) {
    const exec = linked.find((e) => e.kind === 'agreement_execution');
    const anchor = exec ?? linked[0]!;
    const primary = anchor.primary_entity_id;
    const cp = new Set<string>();
    for (const e of linked) {
      for (const x of e.counterparty_entity_ids) cp.add(x);
    }
    for (const x of paraCpIds) {
      if (x !== primary) cp.add(x);
    }
    return {
      primary_entity_id: primary,
      counterparty_entity_ids: [...cp].sort(),
    };
  }

  const orgFromEdges = new Set<string>();
  for (const r of relationships) {
    if (r.source !== blockId) continue;
    if (
      (r.type === 'constrains' || r.type === 'defines') &&
      r.target.startsWith(ENTITY_ID_PREFIX)
    ) {
      orgFromEdges.add(r.target);
    }
  }

  if (issuerId) {
    const cp = new Set<string>();
    for (const id of orgFromEdges) {
      if (id !== issuerId) cp.add(id);
    }
    for (const id of paraCpIds) {
      if (id !== issuerId) cp.add(id);
    }
    return {
      primary_entity_id: issuerId,
      counterparty_entity_ids: [...cp].sort(),
    };
  }

  const sorted = [...orgFromEdges].sort();
  if (sorted.length === 1) {
    return {
      primary_entity_id: sorted[0]!,
      counterparty_entity_ids: [],
    };
  }
  if (sorted.length >= 2) {
    return {
      primary_entity_id: sorted[0]!,
      counterparty_entity_ids: sorted.slice(1),
    };
  }

  return {
    primary_entity_id: null,
    counterparty_entity_ids: [...paraCpIds],
  };
}

function structuredConfidence(
  clauseType: NormalizedClauseType,
  extracted: ExtractedFields,
  linkedEventsCount: number,
): number {
  let score =
    clauseType === 'structural' || clauseType === 'other'
      ? 0.42
      : clauseType === 'disclosure'
        ? 0.55
        : clauseType === 'obligation' ||
            clauseType === 'indemnity' ||
            clauseType === 'payment'
          ? 0.5
          : 0.58;

  switch (clauseType) {
    case 'pricing_terms': {
      const p = extracted.pricing;
      if (p) {
        if ((p.modes?.length ?? 0) > 0) score += 0.28;
        if (p.discount_rate !== undefined || p.mechanism !== 'other') {
          score += 0.12;
        }
      }
      break;
    }
    case 'constraint': {
      const c = extracted.constraints;
      if (c) {
        const n =
          (c.exchange_issuance?.length ?? 0) +
          (c.beneficial_ownership?.length ?? 0) +
          (c.other_constraints?.length ?? 0);
        if (n > 0) score += 0.2;
      }
      break;
    }
    case 'termination': {
      const t = extracted.termination;
      if (t) {
        if (
          t.stated_term_months !== undefined ||
          t.stated_term_days !== undefined ||
          t.termination_notice_days !== undefined
        ) {
          score += 0.12;
        }
        if (t.aggregate_purchase_ceiling_usd !== undefined) {
          score += 0.08;
        }
      }
      break;
    }
    case 'disclosure': {
      const d = extracted.disclosure;
      if (d) {
        const hasFin = d.financial?.largest_amount_usd !== undefined;
        const hasIss = d.issuance?.largest_share_count !== undefined;
        if (hasFin || hasIss) score += 0.18;
      }
      break;
    }
    case 'structural': {
      const s = extracted.structural;
      if (s && (s.agreement_reference_date_iso || s.execution_date_iso)) {
        score += 0.14;
      }
      break;
    }
    case 'obligation':
    case 'indemnity':
    case 'payment':
    case 'other':
      break;
    default: {
      const _x: never = clauseType;
      return _x;
    }
  }

  if (linkedEventsCount > 0) score += 0.08;

  return Math.min(0.96, Math.round(score * 100) / 100);
}

export type BuildLayer1FilingInput = {
  entity_registry: EntityRegistry;
  block_registry: Record<string, BlockRegistryEntry>;
  events: GraphEvent[];
  relationships: DocumentRelationship[];
  sections: Clause[] | FilingSectionNode[];
};

export function buildLayer1FilingInput(
  input: BuildLayer1FilingInput,
): Layer1Filing {
  return {
    entity_registry: input.entity_registry,
    block_registry: input.block_registry,
    events: input.events,
    relationships: input.relationships,
    sections: input.sections as FilingSectionNode[],
  };
}

export function projectNormalizedClausesFromLayer1(
  filing: Layer1Filing,
): NormalizedClauseRecord[] {
  const sections = filing.sections ?? [];
  const paraById = collectParagraphMap(sections);
  const allConstraints = collectAllSectionConstraints(sections);
  const issuerId =
    sections.length > 0
      ? resolveIssuerEntityId(
          sections as unknown as Clause[],
          filing.entity_registry,
        )
      : undefined;

  const blockEntries = Object.values(filing.block_registry).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const raw: NormalizedClauseRecord[] = [];

  for (const block of blockEntries) {
    const clause_type = layer1BlockTypeToClauseType(block.type);
    const factsParts: FactsV2[] = [];
    for (const pid of block.paragraph_ids) {
      const p = paraById.get(pid);
      if (p?.facts) factsParts.push(p.facts as FactsV2);
    }
    const merged =
      factsParts.length > 0 ? mergeFacts(factsParts) : undefined;
    const relevantConstraints = constraintsForBlock(block, allConstraints);

    const linked = linkedEventsForBlock(
      block.id,
      filing.events,
      filing.relationships,
    );
    const paraHints = paragraphCounterpartyHints(block, paraById);
    const entities = resolveClauseEntities(
      block.id,
      linked,
      filing.relationships,
      issuerId,
      paraHints,
    );

    const extracted =
      buildExtractedFieldsForBlock(
        clause_type,
        block,
        merged,
        relevantConstraints,
        paraById,
        linked,
        entities.primary_entity_id ?? '',
        entities.counterparty_entity_ids,
      ) ?? {};

    const baseConfidence = structuredConfidence(clause_type, extracted, linked.length);
    const rec: NormalizedClauseRecord = {
      clause_id: block.id,
      clause_type,
      source_block_id: block.id,
      source_paragraph_ids: [...block.paragraph_ids],
      primary_entity_id: entities.primary_entity_id ?? '',
      counterparty_entity_ids: entities.counterparty_entity_ids,
      event_ids: linked.map((e) => e.id).sort(),
      event_kinds: [...new Set(linked.map((e) => e.kind))].sort(),
      relationships: sliceRelationships(block.id, filing.relationships),
      extracted_fields: extracted,
      confidence: applyStructuralConfidenceCap(
        clause_type,
        baseConfidence,
        linked.length,
        extracted,
      ),
      priority: PRIORITY_BY_TYPE[clause_type],
    };

    raw.push(rec);
  }

  const merged = mergeTerminationDomainIntoCanonical(raw);
  const out = merged.map((rec) => prepareLayer2ClauseForExport(rec));
  assertLayer2ClauseBlocks(out);
  return out;
}
