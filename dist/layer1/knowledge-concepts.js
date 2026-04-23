import { CONCEPT_ID_PREFIX, } from './types.js';
const CONCEPT_TYPE_AND_DESC = {
    [`${CONCEPT_ID_PREFIX}intraday_purchase`]: {
        type: 'purchase_type',
        description: 'Trades or purchases made during the intraday window in the defined valuation period',
        parent: `${CONCEPT_ID_PREFIX}purchase`,
    },
    [`${CONCEPT_ID_PREFIX}regular_purchase`]: {
        type: 'purchase_type',
        description: 'Non-intraday / regular tranche or purchase under the program',
        parent: `${CONCEPT_ID_PREFIX}purchase`,
    },
    [`${CONCEPT_ID_PREFIX}aggregate_ownership`]: {
        type: 'ownership',
        description: 'Limitations on beneficial or aggregate ownership of the issuer’s securities',
        parent: `${CONCEPT_ID_PREFIX}ownership_lifecycle`,
    },
    [`${CONCEPT_ID_PREFIX}exchange_cap_issuance`]: {
        type: 'issuance',
        description: 'Cap on number of shares or value issuable in connection with a listing exchange or similar rule',
        parent: `${CONCEPT_ID_PREFIX}issuance_policy`,
    },
    [`${CONCEPT_ID_PREFIX}agreement_termination`]: {
        type: 'termination',
        description: 'End of the material definitive agreement or related rights',
        parent: `${CONCEPT_ID_PREFIX}agreement_lifecycle`,
    },
    [`${CONCEPT_ID_PREFIX}purchase`]: {
        type: 'abstract',
        description: 'Purchase program mechanics (tranches, timing, and notice concepts)',
    },
    [`${CONCEPT_ID_PREFIX}ownership_lifecycle`]: {
        type: 'abstract',
        description: 'Holder-side limits on ownership, aggregation, and beneficial interest',
    },
    [`${CONCEPT_ID_PREFIX}issuance_policy`]: {
        type: 'abstract',
        description: 'Policy concepts governing when and how much stock may be issued under rules',
    },
    [`${CONCEPT_ID_PREFIX}agreement_lifecycle`]: {
        type: 'abstract',
        description: 'Lifecycle of the material definitive agreement, including end states',
    },
};
/**
 * All `concept:*` ids referenced in relationships, with definitions, hierarchy, and supporting paragraphs.
 */
export function buildConceptRegistry(relationships, sourceByConcept) {
    const used = new Set();
    for (const r of relationships) {
        for (const end of [r.source, r.target]) {
            if (end.startsWith(CONCEPT_ID_PREFIX))
                used.add(end);
        }
    }
    let grow = true;
    while (grow) {
        grow = false;
        for (const id of [...used]) {
            const p = CONCEPT_TYPE_AND_DESC[id]?.parent;
            if (p && !used.has(p)) {
                used.add(p);
                grow = true;
            }
        }
    }
    const undefinedConceptRefs = [];
    const concepts = {};
    for (const id of used) {
        const def = CONCEPT_TYPE_AND_DESC[id];
        if (!def) {
            undefinedConceptRefs.push(id);
            continue;
        }
        const paras = sourceByConcept.get(id) ?? [];
        const rec = {
            type: def.type,
            description: def.description,
            source_paragraphs: [...paras].sort(),
        };
        if (def.parent)
            rec.parent = def.parent;
        concepts[id] = rec;
    }
    return { concepts, undefinedConceptRefs };
}
//# sourceMappingURL=knowledge-concepts.js.map