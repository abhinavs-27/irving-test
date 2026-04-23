import { buildNormalizedFactsForParagraph } from '../layer1/facts-pipeline.js';
import { extractExplicitClausePricing } from '../layer1/explicit-pricing.js';
import { buildFullSignalsForParagraph } from '../layer1/signal-shape.js';
import { buildSectionEntities } from '../layer1/section-entities.js';
import { atomicKindForLayer1BlockType } from '../layer1/types.js';
import { groupParagraphsIntoBlocks } from '../semantic/semantic-blocks.js';
import { mergeIncompleteParagraphs } from '../text/paragraph-integrity.js';
import { normalizeParagraphText } from '../text/normalize-paragraph.js';
/**
 * Structural Layer 1: facts, explicit signals/pricing, atomicKind, section entities, blocks.
 */
export function normalizeParagraphNodesAndGroupBlocks(sections) {
    const registrantName = sections.find((s) => s.id === 'header' || s.type === 'metadata')
        ?.filingHeader?.company?.name ?? null;
    return sections.map((s) => {
        const normalized = s.children.map((p) => ({
            ...p,
            text: normalizeParagraphText(p.text),
        }));
        const merged = normalized.length > 0
            ? mergeIncompleteParagraphs(s.id, normalized)
            : [];
        const children = merged.map((p) => {
            const text = p.text;
            const signals = buildFullSignalsForParagraph(text);
            const pricing = extractExplicitClausePricing(text);
            const facts = buildNormalizedFactsForParagraph(text);
            return {
                ...p,
                text,
                facts,
                signals,
                ...(pricing ? { pricing } : {}),
            };
        });
        let next = { ...s, children };
        if (s.type === 'section' && children.length) {
            next = {
                ...next,
                entities: buildSectionEntities(children, registrantName),
            };
        }
        if (next.children.length > 0 &&
            (next.type === 'section' ||
                next.type === 'metadata' ||
                next.type === 'footer')) {
            const blocks = groupParagraphsIntoBlocks(next, children);
            const byId = new Map(children.map((c) => [c.id, c]));
            for (const b of blocks) {
                const ak = atomicKindForLayer1BlockType(b.type);
                for (const pid of b.paragraph_ids) {
                    const ch = byId.get(pid);
                    if (ch)
                        byId.set(pid, { ...ch, atomicKind: ak });
                }
            }
            const reconciled = children.map((c) => byId.get(c.id) ?? c);
            next = { ...next, children: reconciled, blocks, text: '' };
        }
        else if (next.children.length > 0) {
            next = { ...next, text: '' };
        }
        return next;
    });
}
//# sourceMappingURL=enrich-segments.js.map