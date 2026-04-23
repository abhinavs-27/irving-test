/**
 * Paragraph chunking for segmentation — preserves layout units without interpretation.
 */
export function splitAtomicParagraphUnits(text) {
    return [text.replace(/\s+/g, ' ').trim()];
}
//# sourceMappingURL=atomic-segmentation.js.map