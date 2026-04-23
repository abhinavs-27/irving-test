import { EVENT_ID_PREFIX } from './types.js';
import { B_RILEY_PRINCIPAL_ID, resolveIssuerEntityId, resolveNameToEntityId, } from './entity-registry.js';
import { findBlockIdContainingParagraph } from './block-registry.js';
const AGREEMENT_TITLE_PATTERNS = [
    /\b(Common Stock Purchase Agreement)\b/gi,
    /\b(Registration Rights Agreement)\b/gi,
    /\b(Purchase Agreement)\b/gi,
];
/**
 * Explicit agreement titles appearing in `text` (stable order, deduped).
 */
export function extractAgreementTypesFromText(text) {
    const seen = new Set();
    const out = [];
    for (const re of AGREEMENT_TITLE_PATTERNS) {
        re.lastIndex = 0;
        let m;
        const r = new RegExp(re.source, re.flags);
        while ((m = r.exec(text)) != null) {
            const raw = m[1] ?? m[0];
            const t = raw.replace(/\s+/g, ' ').trim();
            if (!t || seen.has(t))
                continue;
            seen.add(t);
            out.push(t);
        }
    }
    if (out.includes('Common Stock Purchase Agreement') && out.includes('Purchase Agreement')) {
        return out.filter((x) => x !== 'Purchase Agreement');
    }
    return out;
}
function counterpartyIdsForEvent(entityRegistry, issuerId, explicitCounterparty) {
    const out = [];
    const add = (id) => {
        if (!id || out.includes(id))
            return;
        if (issuerId && id === issuerId)
            return;
        if (entityRegistry[id])
            out.push(id);
    };
    add(explicitCounterparty);
    add(B_RILEY_PRINCIPAL_ID in entityRegistry ? B_RILEY_PRINCIPAL_ID : undefined);
    return out;
}
/**
 * Agreement execution + termination events with full normalized fields.
 */
export function buildDocumentEvents(sections, entityRegistry) {
    const events = [];
    const eventIdByBlock = new Map();
    const eid = (slug) => `${EVENT_ID_PREFIX}${slug}`;
    const issuerId = resolveIssuerEntityId(sections, entityRegistry);
    if (!issuerId) {
        return { events, eventIdByBlock };
    }
    const s101 = sections.find((s) => s.id === '1.01' && s.type === 'section');
    const p1 = s101?.children.find((c) => c.type === 'paragraph' && c.id === '1.01.p1') ??
        s101?.children.find((c) => c.type === 'paragraph');
    if (p1) {
        const d0 = p1.facts?.dates[0];
        const cpId = p1.signals?.legal_signals?.counterparty_id ??
            resolveNameToEntityId(p1.signals?.legal_signals?.counterparty, entityRegistry);
        const counterparty_entity_ids = counterpartyIdsForEvent(entityRegistry, issuerId, cpId);
        const agreement_types = extractAgreementTypesFromText(p1.text);
        const blockId = findBlockIdContainingParagraph(sections, p1.id) ??
            s101?.blocks?.find((b) => b.type === 'structural')?.id;
        if (blockId) {
            const ev = {
                id: eid(`agreement_execution_${p1.id.replace(/[^a-z0-9.]+/gi, '_')}`),
                kind: 'agreement_execution',
                label: p1.text.trim().split(/\n/)[0].trim().slice(0, 160),
                primary_entity_id: issuerId,
                counterparty_entity_ids,
                agreement_types,
                source_block_ids: [blockId],
            };
            if (d0)
                ev.as_of_date = d0;
            events.push(ev);
        }
    }
    for (const s of sections) {
        if (s.type !== 'section' || !s.blocks)
            continue;
        for (const b of s.blocks) {
            if (b.type !== 'termination')
                continue;
            const tev = eid(`termination_${b.id.replace(/[^a-z0-9]+/gi, '_')}`);
            const counterparty_entity_ids = counterpartyIdsForEvent(entityRegistry, issuerId, undefined);
            events.push({
                id: tev,
                kind: 'agreement_termination',
                label: 'Termination or expiration (per cited paragraphs in block)',
                primary_entity_id: issuerId,
                counterparty_entity_ids,
                agreement_types: [],
                source_block_ids: [b.id],
            });
            eventIdByBlock.set(b.id, tev);
        }
    }
    return { events, eventIdByBlock };
}
export function eventKindToLabel(k) {
    switch (k) {
        case 'agreement_execution':
            return 'Agreement execution';
        case 'commencement':
            return 'Commencement';
        case 'agreement_termination':
            return 'Termination';
        default:
            return 'Event';
    }
}
//# sourceMappingURL=document-events.js.map