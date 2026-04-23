import { EVENT_ID_PREFIX } from './types.js';
import { buildSectionConstraints } from './section-constraints.js';
import { buildNormalizedFactsForParagraph } from './facts-pipeline.js';
import { resolveIssuerEntityId } from './entity-registry.js';
function collectParagraphIds(sections) {
    const s = new Set();
    const walk = (nodes) => {
        for (const n of nodes) {
            if (n.type === 'paragraph')
                s.add(n.id);
            if (n.children.length)
                walk(n.children);
        }
    };
    walk(sections);
    return s;
}
function paragraphById(sections) {
    const m = new Map();
    const walk = (nodes) => {
        for (const n of nodes) {
            if (n.type === 'paragraph')
                m.set(n.id, n);
            if (n.children.length)
                walk(n.children);
        }
    };
    walk(sections);
    return m;
}
/**
 * Validates output against `specs/extraction_contract.md`.
 */
export function validateExtractionContract(sections, entity_registry, block_registry, events, relationships) {
    const violations = [];
    const paraIds = collectParagraphIds(sections);
    const paraMap = paragraphById(sections);
    const blockIds = new Set(Object.keys(block_registry));
    const orgIds = new Set(Object.keys(entity_registry));
    const eventIds = new Set(events.map((e) => e.id));
    const assignedPara = new Set();
    for (const b of Object.values(block_registry)) {
        for (const pid of b.paragraph_ids) {
            if (assignedPara.has(pid)) {
                violations.push({
                    code: 'paragraph_multi_block',
                    path: `block_registry/${b.id}`,
                    message: `paragraph ${pid} assigned to multiple blocks`,
                });
            }
            assignedPara.add(pid);
            if (!paraIds.has(pid)) {
                violations.push({
                    code: 'block_unknown_paragraph',
                    path: `block_registry/${b.id}`,
                    message: `unknown paragraph id ${pid}`,
                });
            }
        }
    }
    for (const pid of paraIds) {
        if (!assignedPara.has(pid)) {
            violations.push({
                code: 'paragraph_unassigned',
                path: `sections/${pid}`,
                message: 'paragraph not in exactly one block_registry entry',
            });
        }
    }
    for (const [bid, br] of Object.entries(block_registry)) {
        if (!br.paragraph_ids?.length) {
            violations.push({
                code: 'block_empty',
                path: `block_registry/${bid}`,
                message: 'block has no paragraph_ids',
            });
        }
        if (!br.semantic_role) {
            violations.push({
                code: 'block_no_semantic_role',
                path: `block_registry/${bid}`,
                message: 'missing semantic_role',
            });
        }
    }
    for (const pid of paraIds) {
        const p = paraMap.get(pid);
        if (!p || p.type !== 'paragraph')
            continue;
        if (p.atomicKind == null || String(p.atomicKind).trim() === '') {
            violations.push({
                code: 'paragraph_no_atomic_kind',
                path: `sections/${pid}`,
                message: 'paragraph lacks atomicKind classification',
            });
        }
    }
    const issuerResolved = resolveIssuerEntityId(sections, entity_registry);
    for (const e of events) {
        const ep = `events/${e.id}`;
        if (!e.primary_entity_id || !orgIds.has(e.primary_entity_id)) {
            violations.push({
                code: 'event_primary',
                path: ep,
                message: 'invalid or missing primary_entity_id',
            });
        }
        if (!e.counterparty_entity_ids?.length) {
            violations.push({
                code: 'event_counterparty',
                path: ep,
                message: 'missing counterparty_entity_ids',
            });
        }
        for (const c of e.counterparty_entity_ids ?? []) {
            if (!orgIds.has(c)) {
                violations.push({
                    code: 'event_counterparty_unknown',
                    path: ep,
                    message: `unknown org ${c}`,
                });
            }
        }
        if (!Array.isArray(e.agreement_types)) {
            violations.push({
                code: 'event_agreement_types',
                path: ep,
                message: 'agreement_types must be array',
            });
        }
        if (!e.source_block_ids?.length) {
            violations.push({
                code: 'event_source_blocks',
                path: ep,
                message: 'missing source_block_ids',
            });
        }
        for (const sb of e.source_block_ids ?? []) {
            if (!blockIds.has(sb)) {
                violations.push({
                    code: 'event_unknown_block',
                    path: ep,
                    message: `unknown source_block_id ${sb}`,
                });
            }
        }
        const kind = e.kind;
        const hasDateInSource = kind === 'agreement_execution' || kind === 'agreement_termination';
        if (hasDateInSource) {
            const paras = e.source_block_ids.flatMap((bid) => block_registry[bid]?.paragraph_ids ?? []);
            let textHasIso = false;
            for (const pid of paras) {
                const px = paraMap.get(pid);
                if (px?.facts?.dates?.length)
                    textHasIso = true;
            }
            if (textHasIso && !e.as_of_date) {
                violations.push({
                    code: 'event_missing_as_of_date',
                    path: ep,
                    message: 'ISO date present in source paragraphs but as_of_date missing on event',
                });
            }
        }
        if (e.kind === 'agreement_termination') {
            const lab = e.label.trim();
            if (lab.length < 40 ||
                /^\s*Termination or expiration \(per cited paragraphs in block\)\s*$/i.test(lab)) {
                violations.push({
                    code: 'termination_label_generic',
                    path: ep,
                    message: 'termination event must include substantive conditions text (not generic label only)',
                });
            }
        }
    }
    const governPairs = new Set();
    const triggerPairs = new Set();
    const constrainPairs = new Set();
    for (const r of relationships) {
        if (!blockIds.has(r.source)) {
            violations.push({
                code: 'rel_bad_source',
                path: `relationships/${r.type}`,
                message: `unknown block source ${r.source}`,
            });
            continue;
        }
        const t = r.target;
        if (r.type === 'governs') {
            if (!paraIds.has(t)) {
                violations.push({
                    code: 'rel_governs_target',
                    path: `relationships/governs`,
                    message: `governs target must be paragraph id: ${t}`,
                });
            }
            else {
                governPairs.add(`${r.source}|${t}`);
            }
        }
        if (r.type === 'triggers') {
            if (!t.startsWith(EVENT_ID_PREFIX) || !eventIds.has(t)) {
                violations.push({
                    code: 'rel_triggers_target',
                    path: `relationships/triggers`,
                    message: `triggers target must be event id: ${t}`,
                });
            }
            else {
                triggerPairs.add(`${r.source}|${t}`);
            }
        }
        if (r.type === 'constrains' && t.startsWith('org:')) {
            constrainPairs.add(`${r.source}|${t}`);
        }
    }
    for (const [bid, br] of Object.entries(block_registry)) {
        for (const pid of br.paragraph_ids) {
            const k = `${bid}|${pid}`;
            if (!governPairs.has(k)) {
                violations.push({
                    code: 'missing_governs',
                    path: `block_registry/${bid}`,
                    message: `missing governs edge for paragraph ${pid}`,
                });
            }
        }
    }
    for (const [bid, br] of Object.entries(block_registry)) {
        if (br.semantic_role !== 'termination')
            continue;
        const ev = events.find((e) => e.kind === 'agreement_termination' &&
            e.source_block_ids.includes(bid));
        if (!ev) {
            violations.push({
                code: 'termination_block_no_event',
                path: `block_registry/${bid}`,
                message: 'termination block has no matching event',
            });
            continue;
        }
        if (!triggerPairs.has(`${bid}|${ev.id}`)) {
            violations.push({
                code: 'missing_triggers',
                path: `block_registry/${bid}`,
                message: `missing triggers edge to ${ev.id}`,
            });
        }
    }
    for (const [bid, br] of Object.entries(block_registry)) {
        if (br.semantic_role !== 'constraint')
            continue;
        const issuer = issuerResolved ?? events.find((x) => x.primary_entity_id)?.primary_entity_id;
        const cp = events.find((x) => x.counterparty_entity_ids?.length)?.counterparty_entity_ids?.[0];
        if (issuer && !constrainPairs.has(`${bid}|${issuer}`)) {
            violations.push({
                code: 'missing_constrains_issuer',
                path: `block_registry/${bid}`,
                message: 'constraint block missing constrains edge to issuer',
            });
        }
        if (cp && !constrainPairs.has(`${bid}|${cp}`)) {
            violations.push({
                code: 'missing_constrains_counterparty',
                path: `block_registry/${bid}`,
                message: 'constraint block missing constrains edge to counterparty',
            });
        }
    }
    for (const [bid, br] of Object.entries(block_registry)) {
        const pm = br.pricing_model;
        if (!pm)
            continue;
        if (pm.method !== 'VWAP') {
            violations.push({
                code: 'pricing_method',
                path: `block_registry/${bid}/pricing_model`,
                message: 'pricing_model must declare method VWAP when present',
            });
        }
        for (let i = 0; i < pm.modes.length; i++) {
            const mode = pm.modes[i];
            if (mode.discount_percent == null || !Number.isFinite(mode.discount_percent)) {
                violations.push({
                    code: 'pricing_partial_mode',
                    path: `block_registry/${bid}/pricing_model/modes/${i}`,
                    message: 'each pricing mode must include discount_percent',
                });
            }
            if (!mode.vwap_window) {
                violations.push({
                    code: 'pricing_partial_window',
                    path: `block_registry/${bid}/pricing_model/modes/${i}`,
                    message: 'each pricing mode must include vwap_window (valuation window)',
                });
            }
        }
    }
    for (const s of sections) {
        if (s.type !== 'section' || !s.blocks?.length)
            continue;
        const constraints = buildSectionConstraints(s);
        const byPid = new Map();
        for (const c of constraints) {
            for (const pid of c.source_paragraph_ids) {
                const arr = byPid.get(pid) ?? [];
                arr.push(c);
                byPid.set(pid, arr);
            }
        }
        const constraintBlock = s.blocks.find((b) => b.type === 'constraint');
        if (!constraintBlock)
            continue;
        for (const pid of constraintBlock.paragraph_ids) {
            const p = s.children.find((ch) => ch.id === pid && ch.type === 'paragraph');
            if (!p)
                continue;
            const t = p.text;
            const facts = p.facts ?? buildNormalizedFactsForParagraph(t);
            const hasLimit = /\b\d+\.\d+\s*%/.test(t) ||
                facts.percentages.some((x) => Math.abs(x - 4.99) < 0.02 || Math.abs(x - 19.99) < 0.02);
            if (hasLimit && (!byPid.has(pid) || byPid.get(pid).length === 0)) {
                violations.push({
                    code: 'constraint_section_missing',
                    path: `sections/${s.id}/${pid}`,
                    message: 'percentage limit in constraint paragraph missing from section constraints',
                });
            }
            if (hasLimit && facts.percentages.length === 0) {
                violations.push({
                    code: 'constraint_facts_percent',
                    path: `sections/${s.id}/${pid}/facts`,
                    message: 'percentage limits must appear in paragraph facts.percentages',
                });
            }
        }
    }
    return violations;
}
//# sourceMappingURL=extraction-contract.js.map