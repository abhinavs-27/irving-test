import { extractLayer1Signals } from './explicit-signals.js';
import { expandLayer1SignalBuckets } from './signal-shape.js';
import { ENTITY_ID_PREFIX } from './types.js';
/** Collapse "B. Riley" / "B Riley" / LLC punctuation for deduplication. */
function entityMergeKey(s) {
    return s
        .toLowerCase()
        .replace(/\b([a-z])\s*\./g, '$1')
        .replace(/&/g, ' and ')
        .replace(/[,'"]/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function toEntityIdFromName(name) {
    const s = name
        .replace(/[.,&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const slug = s
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.replace(/[^a-z0-9_]/g, ''))
        .filter(Boolean)
        .join('_');
    return `${ENTITY_ID_PREFIX}${(slug || 'entity').slice(0, 96)}`;
}
/**
 * All named orgs from `entities` + `legal_signals.counterparty` (split on |) + counterparty string.
 */
export function collectEntityNames(sections) {
    const out = [];
    for (const s of sections) {
        for (const o of s.entities?.organizations ?? []) {
            if (o.trim().length > 1)
                out.push(o.trim());
        }
        for (const p of s.children) {
            if (p.type !== 'paragraph' || !p.signals?.legal_signals)
                continue;
            const c = p.signals.legal_signals.counterparty;
            if (c) {
                for (const part of c.split(/\s*\|\s*/)) {
                    if (part.trim().length > 1)
                        out.push(part.trim());
                }
            }
        }
    }
    return out;
}
/**
 * Deduplicate by normalized key; first canonical wins.
 */
export function buildEntityRegistry(sections) {
    const byKey = new Map();
    const names = collectEntityNames(sections);
    const usedIds = new Set();
    for (const raw of names) {
        const key = entityMergeKey(raw);
        if (key.length < 2)
            continue;
        if (byKey.has(key)) {
            const x = byKey.get(key);
            if (!x.record.aliases.includes(raw) && raw !== x.record.canonical_name) {
                x.record.aliases.push(raw);
            }
            if (raw.replace(/\s+/g, ' ').trim().length > x.record.canonical_name.length) {
                x.record.canonical_name = raw.replace(/\s+/g, ' ').trim();
            }
            continue;
        }
        let base = toEntityIdFromName(raw);
        let fid = base;
        let n = 1;
        while (usedIds.has(fid)) {
            fid = `${base}_${n++}`;
        }
        usedIds.add(fid);
        byKey.set(key, {
            id: fid,
            record: {
                kind: 'organization',
                canonical_name: raw.replace(/\s+/g, ' ').trim(),
                aliases: [],
            },
        });
    }
    const registry = {};
    for (const { id, record } of byKey.values()) {
        registry[id] = record;
    }
    return consolidateBRileyPrincipalEntity(registry).registry;
}
/** Every transactional counterparty to this 8-K program. Short names are aliases only. */
export const B_RILEY_PRINCIPAL_CANONICAL = 'B. Riley Principal Capital II, LLC';
export const B_RILEY_PRINCIPAL_ID = `${ENTITY_ID_PREFIX}b_riley_principal_capital_ii_llc`;
function isRileyMentioned(text) {
    return /b\.\s*riley|b\s*riley|principal capital ii|riley principal capital/i.test(text);
}
/**
 * Merges all B. Riley–related org rows into one, full legal name as canonical, short forms as aliases.
 */
export function consolidateBRileyPrincipalEntity(registry) {
    const remapped = new Map();
    const toMerge = [];
    for (const [id, r] of Object.entries(registry)) {
        if (isRileyMentioned(r.canonical_name) ||
            r.aliases.some((a) => isRileyMentioned(a))) {
            toMerge.push(id);
        }
    }
    if (toMerge.length === 0) {
        for (const k of Object.keys(registry)) {
            remapped.set(k, k);
        }
        return { registry: { ...registry }, idRemap: remapped };
    }
    for (const id of toMerge) {
        remapped.set(id, B_RILEY_PRINCIPAL_ID);
    }
    const aliases = new Set(['B. Riley', 'B Riley']);
    for (const id of toMerge) {
        const r = registry[id];
        if (r.canonical_name !== B_RILEY_PRINCIPAL_CANONICAL) {
            aliases.add(r.canonical_name);
        }
        for (const a of r.aliases) {
            if (a.trim())
                aliases.add(a.trim());
        }
    }
    for (const k of Object.keys(registry)) {
        if (!toMerge.includes(k) && !remapped.has(k)) {
            remapped.set(k, k);
        }
    }
    const out = {};
    for (const [id, r] of Object.entries(registry)) {
        if (toMerge.includes(id))
            continue;
        out[id] = r;
    }
    out[B_RILEY_PRINCIPAL_ID] = {
        kind: 'organization',
        canonical_name: B_RILEY_PRINCIPAL_CANONICAL,
        aliases: [...aliases]
            .filter((a) => a && a.toLowerCase() !== B_RILEY_PRINCIPAL_CANONICAL.toLowerCase())
            .sort(),
    };
    return { registry: out, idRemap: remapped };
}
/**
 * Map counterparty / fragment text to entity id (longest alias match first).
 */
export function resolveNameToEntityId(name, registry) {
    if (!name?.trim())
        return undefined;
    const t = name.trim();
    const tLower = t.toLowerCase();
    for (const [id, r] of Object.entries(registry)) {
        if (r.canonical_name === t)
            return id;
        for (const a of r.aliases) {
            if (a === t)
                return id;
        }
    }
    const candidates = [];
    for (const [id, r] of Object.entries(registry)) {
        for (const a of [r.canonical_name, ...r.aliases]) {
            const al = a.toLowerCase();
            if (a === t || tLower === al) {
                return id;
            }
            if (tLower.includes(al) || al.includes(tLower)) {
                candidates.push({ id, score: a.length });
            }
        }
    }
    if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].id;
    }
    return undefined;
}
/**
 * Deterministic issuer / registrant org id (excludes consolidated B. Riley counterparty row).
 */
export function resolveIssuerEntityId(sections, registry) {
    const orgNames = [];
    for (const s of [...sections].sort((a, b) => a.id.localeCompare(b.id))) {
        for (const o of s.entities?.organizations ?? []) {
            if (o.trim())
                orgNames.push(o.trim());
        }
    }
    for (const name of orgNames) {
        const id = resolveNameToEntityId(name, registry);
        if (id && id !== B_RILEY_PRINCIPAL_ID) {
            return id;
        }
    }
    const sortedIds = Object.keys(registry).sort();
    for (const id of sortedIds) {
        if (id === B_RILEY_PRINCIPAL_ID)
            continue;
        const r = registry[id];
        const blob = `${r.canonical_name} ${r.aliases.join(' ')}`;
        if (/\bgelesis\b/i.test(blob)) {
            return id;
        }
    }
    for (const id of sortedIds) {
        if (id !== B_RILEY_PRINCIPAL_ID) {
            return id;
        }
    }
    return undefined;
}
/**
 * Re-run signal extraction and attach `counterparty_id` / `counterparty_raw` (machine-executable; preserves legacy fields).
 */
export function applyEntityIdsToParagraphs(sections, registry) {
    return sections.map((s) => {
        if (s.type !== 'section' && s.type !== 'metadata' && s.type !== 'footer') {
            return s;
        }
        const children = s.children.map((p) => {
            if (p.type !== 'paragraph')
                return p;
            return {
                ...p,
                signals: buildSignalsWithEntityRegistry(p.text, registry),
            };
        });
        return { ...s, children };
    });
}
/**
 * Full signal buckets + `counterparty_id` (no cycle: lives next to `resolveNameToEntityId`).
 */
export function buildSignalsWithEntityRegistry(text, registry) {
    const base = expandLayer1SignalBuckets(extractLayer1Signals(text));
    const cp = base.legal_signals?.counterparty;
    if (cp) {
        const id = resolveNameToEntityId(cp, registry);
        if (id) {
            return {
                ...base,
                legal_signals: {
                    ...base.legal_signals,
                    counterparty: base.legal_signals?.counterparty,
                    counterparty_id: id,
                    counterparty_raw: base.legal_signals?.counterparty_raw ?? cp,
                },
            };
        }
    }
    return base;
}
//# sourceMappingURL=entity-registry.js.map