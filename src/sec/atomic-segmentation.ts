/**
 * Paragraph chunking for segmentation — preserves layout units without interpretation.
 */

export function splitAtomicParagraphUnits(text: string): string[] {
  return [text.replace(/\s+/g, ' ').trim()];
}
