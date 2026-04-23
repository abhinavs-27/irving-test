import { legalDocLog } from '../logging.js';
import { mergeSoftParagraphBreaks } from '../text/merge-paragraph-glue.js';
import { splitAtomicParagraphUnits } from './atomic-segmentation.js';
/** Merge-only threshold: shorter fragments are joined to neighbors (text is never dropped). */
const DEFAULT_MIN_PARAGRAPH_CHARS = 30;
/** When the whole section has almost no `\n\n` breaks, split dense text into ~this size. */
const DENSE_SPLIT_TARGET_CHARS = 1400;
/**
 * Split a very large single block on single newlines into rough paragraph-sized units.
 */
function splitDenseSingleBlock(text, targetLen) {
    const lines = text.split(/\n/).map((l) => l.trimEnd());
    const out = [];
    let buf = '';
    for (const line of lines) {
        const candidate = buf ? `${buf}\n${line}` : line;
        if (candidate.length > targetLen && buf.length > 0) {
            out.push(buf.trim());
            buf = line;
        }
        else {
            buf = candidate;
        }
    }
    if (buf.trim())
        out.push(buf.trim());
    return out.length > 0 ? out : [text.trim()];
}
/**
 * Merge fragments shorter than `minLen` into the previous segment so nothing is discarded.
 */
function mergeShortFragments(parts, minLen) {
    const merged = [];
    for (const p of parts) {
        const piece = p.trim();
        if (!piece)
            continue;
        if (merged.length === 0) {
            merged.push(piece);
            continue;
        }
        const last = merged[merged.length - 1];
        if (last.length < minLen || piece.length < minLen) {
            merged[merged.length - 1] = `${last}\n\n${piece}`;
        }
        else {
            merged.push(piece);
        }
    }
    return merged;
}
/**
 * Paragraph-level atomic units: `{sectionId}.p1`, `{sectionId}.p2`, …
 * Multi-concept paragraphs are split further into atomic clause nodes.
 */
export function splitIntoParagraphs(section) {
    const raw = mergeSoftParagraphBreaks(section.text);
    if (!raw.trim())
        return [];
    let chunks = raw
        .split(/\n\s*\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (chunks.length === 0) {
        chunks = [raw.trim()];
    }
    if (chunks.length === 1 && chunks[0].length > DENSE_SPLIT_TARGET_CHARS) {
        chunks = splitDenseSingleBlock(chunks[0], DENSE_SPLIT_TARGET_CHARS);
        chunks = mergeShortFragments(chunks, DEFAULT_MIN_PARAGRAPH_CHARS);
    }
    const atomicTexts = [];
    for (const chunk of chunks) {
        atomicTexts.push(...splitAtomicParagraphUnits(chunk));
    }
    let pi = 1;
    const paragraphs = atomicTexts.map((text) => ({
        id: `${section.id}.p${pi++}`,
        title: '',
        text,
        type: 'paragraph',
        children: [],
    }));
    const totalChars = paragraphs.reduce((s, p) => s + p.text.length, 0);
    const avgLen = paragraphs.length > 0 ? Math.round(totalChars / paragraphs.length) : 0;
    legalDocLog.info('Paragraph segmentation', {
        sectionId: section.id,
        sectionType: section.type,
        paragraphCount: paragraphs.length,
        avgParagraphChars: avgLen,
    });
    return paragraphs;
}
/**
 * Attach paragraph children; **section body text is cleared** when children exist (children win).
 */
export function withParagraphChildren(section) {
    if (section.id === 'header' && section.filingHeader) {
        return { ...section, children: [], text: '' };
    }
    const children = section.type === 'metadata' ||
        section.type === 'section' ||
        section.type === 'footer'
        ? splitIntoParagraphs(section)
        : [];
    let next = { ...section, children };
    if (next.children.length > 0 &&
        (next.type === 'section' || next.type === 'footer' || next.type === 'metadata')) {
        next = { ...next, text: '' };
    }
    return next;
}
/**
 * Run paragraph splitting on every SEC segment that carries body text.
 */
export function segmentSectionsIntoParagraphs(sections) {
    const out = sections.map(withParagraphChildren);
    let totalParas = 0;
    let totalParaChars = 0;
    for (const s of out) {
        totalParas += s.children.length;
        for (const p of s.children)
            totalParaChars += p.text.length;
    }
    legalDocLog.info('Document paragraph segmentation summary', {
        topLevelSections: out.length,
        totalParagraphUnits: totalParas,
        avgParagraphCharsGlobal: totalParas > 0 ? Math.round(totalParaChars / totalParas) : 0,
        paragraphsPerSection: Object.fromEntries(out.map((s) => [s.id, s.children.length])),
    });
    return out;
}
//# sourceMappingURL=split-paragraphs.js.map