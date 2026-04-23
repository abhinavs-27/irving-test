import type { BlockRegistryEntry } from './block-registry.js';
import type { Layer1Filing, FilingSectionNode } from './filing-types.js';
import type { FactsV2 } from './types.js';
import { ENTITY_ID_PREFIX, EVENT_ID_PREFIX } from './types.js';

export type FilingValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type FilingValidationResult = {
  ok: boolean;
  issues: FilingValidationIssue[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isUsd(x: unknown): x is { value: number; currency: 'USD' } {
  if (typeof x !== 'object' || x == null) return false;
  const o = x as { value?: unknown; currency?: unknown };
  return (
    typeof o.value === 'number' &&
    Number.isFinite(o.value) &&
    o.currency === 'USD'
  );
}

/** Structural checks aligned with JSON Schema required fields (no external AJV dependency). */
export function validateFilingSchemaShape(filing: unknown): FilingValidationResult {
  const issues: FilingValidationIssue[] = [];
  if (typeof filing !== 'object' || filing == null) {
    return {
      ok: false,
      issues: [
        {
          code: 'root_type',
          path: '',
          message: 'filing must be an object',
        },
      ],
    };
  }
  const f = filing as Record<string, unknown>;
  for (const k of ['entity_registry', 'block_registry', 'events', 'relationships']) {
    if (!(k in f)) {
      issues.push({
        code: 'missing_top_level',
        path: k,
        message: `missing required property: ${k}`,
      });
    }
  }
  if (issues.length) return { ok: false, issues };

  const er = f['entity_registry'] as Record<string, unknown>;
  for (const [id, rec] of Object.entries(er)) {
    const path = `entity_registry/${id}`;
    if (!id.startsWith(`${ENTITY_ID_PREFIX}`)) {
      issues.push({
        code: 'entity_key',
        path,
        message: 'entity registry keys must start with org:',
      });
    }
    if (typeof rec !== 'object' || rec == null) {
      issues.push({ code: 'entity_shape', path, message: 'must be object' });
      continue;
    }
    const r = rec as Record<string, unknown>;
    for (const req of ['kind', 'canonical_name', 'aliases']) {
      if (!(req in r)) {
        issues.push({
          code: 'entity_required',
          path: `${path}/${req}`,
          message: `missing ${req}`,
        });
      }
    }
  }

  const br = f['block_registry'] as Record<string, unknown>;
  for (const [bid, rec] of Object.entries(br)) {
    const path = `block_registry/${bid}`;
    if (typeof rec !== 'object' || rec == null) {
      issues.push({ code: 'block_shape', path, message: 'must be object' });
      continue;
    }
    const r = rec as Record<string, unknown>;
    for (const req of ['id', 'type', 'semantic_role', 'paragraph_ids']) {
      if (!(req in r)) {
        issues.push({
          code: 'block_required',
          path: `${path}/${req}`,
          message: `missing ${req}`,
        });
      }
    }
    const pids = r['paragraph_ids'];
    if (!Array.isArray(pids) || pids.length === 0) {
      issues.push({
        code: 'block_paragraph_ids',
        path: `${path}/paragraph_ids`,
        message: 'paragraph_ids must be non-empty array',
      });
    }
  }

  const evs = f['events'] as unknown[];
  if (!Array.isArray(evs)) {
    issues.push({
      code: 'events_type',
      path: 'events',
      message: 'events must be array',
    });
  } else {
    evs.forEach((ev, i) => {
      const path = `events/${i}`;
      if (typeof ev !== 'object' || ev == null) {
        issues.push({ code: 'event_shape', path, message: 'must be object' });
        return;
      }
      const e = ev as Record<string, unknown>;
      for (const req of [
        'id',
        'kind',
        'label',
        'primary_entity_id',
        'counterparty_entity_ids',
        'agreement_types',
        'source_block_ids',
      ]) {
        if (!(req in e)) {
          issues.push({
            code: 'event_required',
            path: `${path}/${req}`,
            message: `missing ${req}`,
          });
        }
      }
      if (
        typeof e['id'] === 'string' &&
        !String(e['id']).startsWith(EVENT_ID_PREFIX)
      ) {
        issues.push({
          code: 'event_id_pattern',
          path: `${path}/id`,
          message: 'event id must start with event:',
        });
      }
      const sbl = e['source_block_ids'];
      if (!Array.isArray(sbl) || sbl.length === 0) {
        issues.push({
          code: 'event_source_blocks',
          path: `${path}/source_block_ids`,
          message: 'must be non-empty array',
        });
      }
    });
  }

  const rel = f['relationships'] as unknown[];
  if (!Array.isArray(rel)) {
    issues.push({
      code: 'relationships_type',
      path: 'relationships',
      message: 'relationships must be array',
    });
  } else {
    const allowed = new Set([
      'defines',
      'constrains',
      'governs',
      'references',
      'triggers',
    ]);
    rel.forEach((r, i) => {
      const path = `relationships/${i}`;
      if (typeof r !== 'object' || r == null) {
        issues.push({
          code: 'relationship_shape',
          path,
          message: 'must be object',
        });
        return;
      }
      const o = r as Record<string, unknown>;
      for (const req of ['type', 'source', 'target']) {
        if (!(req in o)) {
          issues.push({
            code: 'relationship_required',
            path: `${path}/${req}`,
            message: `missing ${req}`,
          });
        }
      }
      if (typeof o['type'] === 'string' && !allowed.has(o['type'])) {
        issues.push({
          code: 'relationship_enum',
          path: `${path}/type`,
          message: 'invalid relationship type enum',
        });
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

function collectParagraphIdsFromSections(nodes: FilingSectionNode[]): {
  ids: Set<string>;
  duplicates: string[];
} {
  const ids = new Set<string>();
  const duplicates: string[] = [];
  const walk = (n: FilingSectionNode): void => {
    if (n.type === 'paragraph' && n.id) {
      if (ids.has(n.id)) duplicates.push(n.id);
      ids.add(n.id);
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of nodes) walk(n);
  return { ids, duplicates };
}

function walkParagraphNodes(
  nodes: FilingSectionNode[] | undefined,
  fn: (p: FilingSectionNode) => void,
): void {
  if (!nodes) return;
  for (const n of nodes) {
    if (n.type === 'paragraph') fn(n);
    if (n.children?.length) walkParagraphNodes(n.children, fn);
  }
}

/** Business rules beyond JSON Schema (graph invariants). */
export function validateFilingRules(filing: Layer1Filing): FilingValidationResult {
  const issues: FilingValidationIssue[] = [];
  const { entity_registry, block_registry, events, relationships } = filing;
  const orgIds = new Set(Object.keys(entity_registry));
  const blockIds = new Set(Object.keys(block_registry));
  const paraFromBlocks = new Map<string, string>();

  for (const [bid, b] of Object.entries(block_registry)) {
    const br = b as BlockRegistryEntry;
    if (bid !== br.id) {
      issues.push({
        code: 'block_key_id_mismatch',
        path: `block_registry/${bid}`,
        message: `registry key must equal block id (got ${br.id})`,
      });
    }
    for (const pid of br.paragraph_ids) {
      if (paraFromBlocks.has(pid)) {
        issues.push({
          code: 'paragraph_duplicate_block',
          path: `paragraph/${pid}`,
          message: `paragraph in multiple blocks: ${paraFromBlocks.get(pid)}, ${bid}`,
        });
      }
      paraFromBlocks.set(pid, bid);
    }
  }

  if (filing.sections?.length) {
    const { ids: paraInTree, duplicates } = collectParagraphIdsFromSections(
      filing.sections,
    );
    for (const d of duplicates) {
      issues.push({
        code: 'paragraph_duplicate_tree',
        path: `sections/${d}`,
        message: 'duplicate paragraph id in section tree',
      });
    }
    for (const pid of paraFromBlocks.keys()) {
      if (!paraInTree.has(pid)) {
        issues.push({
          code: 'paragraph_orphan_registry',
          path: `block_registry → ${pid}`,
          message: 'paragraph in block_registry but not in sections tree',
        });
      }
    }
    for (const pid of paraInTree) {
      if (!paraFromBlocks.has(pid)) {
        issues.push({
          code: 'paragraph_unassigned',
          path: `sections/${pid}`,
          message: 'paragraph not assigned to exactly one block in block_registry',
        });
      }
    }
  }

  for (const [bid, b] of Object.entries(block_registry)) {
    const br = b as BlockRegistryEntry;
    for (const pid of br.paragraph_ids) {
      const hasEdge = relationships.some(
        (r) =>
          r.type === 'governs' && r.source === bid && r.target === pid,
      );
      if (!hasEdge) {
        issues.push({
          code: 'missing_governs',
          path: `relationships`,
          message: `expected governs ${bid} → ${pid}`,
        });
      }
    }
  }

  for (const r of relationships) {
    if (!blockIds.has(r.source)) {
      issues.push({
        code: 'relationship_bad_source',
        path: `relationships`,
        message: `unknown block source: ${r.source}`,
      });
    }
    const t = r.target;
    if (t.startsWith(`${ENTITY_ID_PREFIX}`)) {
      if (!orgIds.has(t)) {
        issues.push({
          code: 'relationship_bad_org',
          path: `relationships`,
          message: `unknown org target: ${t}`,
        });
      }
    } else if (t.startsWith(EVENT_ID_PREFIX)) {
      const evs = new Set(events.map((e) => e.id));
      if (!evs.has(t)) {
        issues.push({
          code: 'relationship_bad_event',
          path: `relationships`,
          message: `unknown event target: ${t}`,
        });
      }
    } else {
      const inRegistry = paraFromBlocks.has(t);
      if (!inRegistry) {
        issues.push({
          code: 'relationship_bad_paragraph',
          path: `relationships`,
          message: `target is not a known paragraph id: ${t}`,
        });
      }
    }
  }

  for (const e of events) {
    for (const sb of e.source_block_ids) {
      if (!blockIds.has(sb)) {
        issues.push({
          code: 'event_unknown_block',
          path: `events/${e.id}`,
          message: `unknown source_block_id ${sb}`,
        });
      }
    }
    if (!orgIds.has(e.primary_entity_id)) {
      issues.push({
        code: 'event_bad_primary',
        path: `events/${e.id}/primary_entity_id`,
        message: 'primary_entity_id not in entity_registry',
      });
    }
    for (const c of e.counterparty_entity_ids) {
      if (!orgIds.has(c)) {
        issues.push({
          code: 'event_bad_counterparty',
          path: `events/${e.id}`,
          message: `counterparty not in registry: ${c}`,
        });
      }
    }
  }

  for (const [bid, b] of Object.entries(block_registry)) {
    const br = b as BlockRegistryEntry;
    if (br.type === 'pricing_mechanism' && !br.pricing_model) {
      issues.push({
        code: 'pricing_block_missing_model',
        path: `block_registry/${bid}`,
        message: 'pricing_mechanism block must include pricing_model',
      });
    }
    if (br.type === 'constraint') {
      let numeric = false;
      for (const pid of br.paragraph_ids) {
        const para = findParagraph(filing.sections, pid);
        const facts = para?.facts as FactsV2 | undefined;
        if (facts) {
          if (facts.percentages?.length) numeric = true;
          if (facts.dollar_amounts?.some(isUsd)) numeric = true;
          if (facts.share_counts?.some((n) => Number.isFinite(n) && n > 0)) {
            numeric = true;
          }
        }
      }
      if (!numeric) {
        issues.push({
          code: 'constraint_block_no_numeric_fact',
          path: `block_registry/${bid}`,
          message:
            'constraint block must include at least one numeric fact (%, USD, or shares) on a paragraph',
        });
      }
    }
  }

  const semanticByPara = new Map<string, string>();
  for (const [bid, b] of Object.entries(block_registry)) {
    const br = b as BlockRegistryEntry;
    const role = br.semantic_role;
    for (const pid of br.paragraph_ids) {
      if (semanticByPara.has(pid) && semanticByPara.get(pid) !== role) {
        issues.push({
          code: 'paragraph_semantic_conflict',
          path: `paragraph/${pid}`,
          message: 'paragraph maps to conflicting semantic roles via blocks',
        });
      }
      semanticByPara.set(pid, role);
    }
  }

  return { ok: issues.length === 0, issues };
}

function findParagraph(
  nodes: FilingSectionNode[] | undefined,
  id: string,
): FilingSectionNode | undefined {
  if (!nodes) return undefined;
  for (const n of nodes) {
    if (n.type === 'paragraph' && n.id === id) return n;
    const x = findParagraph(n.children, id);
    if (x) return x;
  }
  return undefined;
}

/** Full pipeline: schema shape + graph rules. */
export function validateFiling(
  filing: unknown,
): FilingValidationResult & { schema: FilingValidationResult; rules: FilingValidationResult } {
  const schema = validateFilingSchemaShape(filing);
  if (!schema.ok) {
    return {
      ok: false,
      issues: schema.issues,
      schema,
      rules: { ok: true, issues: [] },
    };
  }
  const rules = validateFilingRules(filing as Layer1Filing);
  return {
    ok: rules.ok,
    issues: [...schema.issues, ...rules.issues],
    schema,
    rules,
  };
}
