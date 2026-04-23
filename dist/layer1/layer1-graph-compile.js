import { EVENT_ID_PREFIX } from './types.js';
import { B_RILEY_PRINCIPAL_ID, resolveIssuerEntityId, } from './entity-registry.js';
import { extractAgreementTypesFromText } from './document-events.js';
function collectReferencedOrgIds(relationships, events) {
    const s = new Set();
    for (const r of relationships) {
        if (r.target.startsWith('org:'))
            s.add(r.target);
    }
    for (const e of events) {
        s.add(e.primary_entity_id);
        for (const c of e.counterparty_entity_ids) {
            s.add(c);
        }
    }
    return s;
}
function firstStructuralBlockId(blockRegistry) {
    const ids = Object.keys(blockRegistry).sort();
    for (const id of ids) {
        if (blockRegistry[id]?.semantic_role === 'structural') {
            return id;
        }
    }
    return ids[0];
}
/**
 * Enforce graph invariants (entity coverage, event fields, termination triggers).
 * Mutates `relationships` and `events` in place until stable or max passes.
 */
export function normalizeLayer1Graph(payload, sections) {
    const { entity_registry, block_registry, events, relationships } = payload;
    const issuerId = resolveIssuerEntityId(sections, entity_registry);
    const anchor = firstStructuralBlockId(block_registry);
    for (let pass = 0; pass < 8; pass++) {
        dedupeRelationships(relationships);
        const orgIds = Object.keys(entity_registry).sort();
        const refd = collectReferencedOrgIds(relationships, events);
        for (const oid of orgIds) {
            if (refd.has(oid))
                continue;
            if (!anchor)
                continue;
            relationships.push({ type: 'defines', source: anchor, target: oid });
            refd.add(oid);
        }
        const execAgreements = events.find((e) => e.kind === 'agreement_execution')?.agreement_types ??
            [];
        for (const ev of events) {
            if (issuerId && (!ev.primary_entity_id || ev.primary_entity_id === '')) {
                ev.primary_entity_id = issuerId;
            }
            if (!ev.counterparty_entity_ids?.length) {
                const cp = B_RILEY_PRINCIPAL_ID in entity_registry
                    ? B_RILEY_PRINCIPAL_ID
                    : orgIds.find((x) => x.startsWith('org:') && x !== ev.primary_entity_id);
                if (cp) {
                    ev.counterparty_entity_ids = [cp];
                }
            }
            if (!ev.source_block_ids?.length && anchor) {
                ev.source_block_ids = [anchor];
            }
            if (ev.kind === 'agreement_termination' &&
                (!ev.agreement_types || ev.agreement_types.length === 0) &&
                execAgreements.length) {
                ev.agreement_types = [...execAgreements];
            }
            if (!ev.agreement_types) {
                ev.agreement_types = [];
            }
        }
        const termBlocks = Object.entries(block_registry).filter(([, b]) => b.semantic_role === 'termination');
        for (const [bid] of termBlocks) {
            const evId = `${EVENT_ID_PREFIX}termination_${bid.replace(/[^a-z0-9]+/gi, '_')}`;
            const hasTrig = relationships.some((r) => r.type === 'triggers' && r.source === bid && r.target === evId);
            if (!hasTrig && events.some((e) => e.id === evId)) {
                relationships.push({ type: 'triggers', source: bid, target: evId });
            }
        }
        const exec = events.find((e) => e.kind === 'agreement_execution');
        if (exec && exec.source_block_ids[0]) {
            const hasTrig = relationships.some((r) => r.type === 'triggers' &&
                r.source === exec.source_block_ids[0] &&
                r.target === exec.id);
            if (!hasTrig) {
                relationships.push({
                    type: 'triggers',
                    source: exec.source_block_ids[0],
                    target: exec.id,
                });
            }
        }
        if (exec && (!exec.agreement_types || exec.agreement_types.length === 0)) {
            const s101 = sections.find((x) => x.id === '1.01' && x.type === 'section');
            const p1 = s101?.children.find((c) => c.type === 'paragraph' && c.id === '1.01.p1') ?? s101?.children.find((c) => c.type === 'paragraph');
            if (p1) {
                exec.agreement_types = extractAgreementTypesFromText(p1.text);
            }
        }
    }
    dedupeRelationships(relationships);
}
function dedupeRelationships(relationships) {
    const seen = new Set();
    const out = [];
    for (const r of relationships) {
        const k = `${r.type}|${r.source}|${r.target}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push(r);
    }
    relationships.length = 0;
    relationships.push(...out);
}
export function validateLayer1Graph(payload, sections) {
    const issues = [];
    const { entity_registry, block_registry, events, relationships } = payload;
    const blockIds = new Set(Object.keys(block_registry));
    const allParagraphIds = new Set();
    for (const s of sections) {
        for (const c of s.children) {
            if (c.type === 'paragraph')
                allParagraphIds.add(c.id);
        }
    }
    const paraToBlock = new Map();
    for (const [bid, b] of Object.entries(block_registry)) {
        for (const pid of b.paragraph_ids) {
            if (paraToBlock.has(pid)) {
                issues.push({
                    path: `paragraphs/${pid}`,
                    code: 'paragraph_multi_block',
                    message: `paragraph ${pid} appears in multiple blocks`,
                });
            }
            paraToBlock.set(pid, bid);
        }
    }
    const orgIds = new Set(Object.keys(entity_registry));
    const eventIds = new Set(events.map((e) => e.id));
    const refOrgs = collectReferencedOrgIds(relationships, events);
    for (const oid of orgIds) {
        if (!refOrgs.has(oid)) {
            issues.push({
                path: `entity_registry/${oid}`,
                code: 'entity_unreferenced',
                message: 'entity never appears in relationships or events',
            });
        }
    }
    for (const [bid, b] of Object.entries(block_registry)) {
        if (!b.id || !b.type || !b.paragraph_ids || !b.semantic_role) {
            issues.push({
                path: `block_registry/${bid}`,
                code: 'block_incomplete',
                message: 'block missing id, type, paragraph_ids, or semantic_role',
            });
        }
    }
    for (const e of events) {
        const p = `events/${e.id}`;
        if (!e.primary_entity_id) {
            issues.push({ path: p, code: 'event_no_primary', message: 'missing primary_entity_id' });
        }
        if (!e.counterparty_entity_ids?.length) {
            issues.push({
                path: p,
                code: 'event_no_counterparty',
                message: 'counterparty_entity_ids must have >= 1',
            });
        }
        if (!e.source_block_ids?.length) {
            issues.push({
                path: p,
                code: 'event_no_blocks',
                message: 'source_block_ids must have >= 1',
            });
        }
        if (!Array.isArray(e.agreement_types)) {
            issues.push({
                path: p,
                code: 'event_no_agreement_types',
                message: 'agreement_types must be an array',
            });
        }
        for (const bid of e.source_block_ids ?? []) {
            if (!blockIds.has(bid)) {
                issues.push({
                    path: p,
                    code: 'event_unknown_block',
                    message: `unknown source_block_id ${bid}`,
                });
            }
        }
    }
    const allowed = new Set([
        'defines',
        'constrains',
        'governs',
        'references',
        'triggers',
    ]);
    for (const r of relationships) {
        const p = `relationships/${r.type}/${r.source}->${r.target}`;
        if (!allowed.has(r.type)) {
            issues.push({ path: p, code: 'rel_type', message: 'invalid relationship type' });
        }
        if (!blockIds.has(r.source)) {
            issues.push({ path: p, code: 'rel_bad_source', message: 'source is not a block id' });
        }
        const t = r.target;
        if (allParagraphIds.has(t)) {
            /* paragraph */
        }
        else if (t.startsWith('org:') && orgIds.has(t)) {
            /* entity */
        }
        else if (t.startsWith(EVENT_ID_PREFIX) && eventIds.has(t)) {
            /* event */
        }
        else {
            issues.push({
                path: p,
                code: 'rel_bad_target',
                message: `target not a known paragraph, org, or event: ${t}`,
            });
        }
    }
    for (const [, b] of Object.entries(block_registry)) {
        if (b.semantic_role === 'termination') {
            const evId = events.find((e) => e.kind === 'agreement_termination' &&
                e.source_block_ids.includes(b.id))?.id;
            if (!evId) {
                issues.push({
                    path: `block_registry/${b.id}`,
                    code: 'termination_no_event',
                    message: 'termination block has no matching termination event',
                });
            }
            else {
                const trig = relationships.some((x) => x.type === 'triggers' && x.source === b.id && x.target === evId);
                if (!trig) {
                    issues.push({
                        path: `block_registry/${b.id}`,
                        code: 'termination_no_trigger',
                        message: 'missing triggers edge from termination block to event',
                    });
                }
            }
        }
    }
    return { ok: issues.length === 0, issues };
}
//# sourceMappingURL=layer1-graph-compile.js.map