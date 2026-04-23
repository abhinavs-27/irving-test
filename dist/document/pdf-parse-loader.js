import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { legalDocLog } from '../logging.js';
/** Lines appearing on at least this fraction of pages are treated as repeated headers/footers. */
const DEFAULT_HEADER_FOOTER_PAGE_RATIO = 0.45;
/** Ignore repeated-line detection for lines shorter than this (often noise). */
const MIN_LINE_LENGTH_FOR_REPEAT_DETECTION = 12;
function normalizeWhitespace(text) {
    const collapsedSpaces = text.replace(/[^\S\r\n]+/g, ' ');
    const cappedNewlines = collapsedSpaces.replace(/\n{3,}/g, '\n\n');
    return cappedNewlines.trim();
}
function splitLines(pageText) {
    return pageText.split(/\r?\n/).map((l) => l.trimEnd());
}
/**
 * Drop lines that appear on many pages (running headers, footers, page numbers).
 */
function stripRepeatedLinesAcrossPages(pageLines, pageRatioThreshold) {
    const pageCount = pageLines.length;
    if (pageCount === 0)
        return pageLines;
    const lineToPages = new Map();
    for (let p = 0; p < pageCount; p++) {
        const seenOnPage = new Set();
        for (const line of pageLines[p]) {
            const normalized = line.trim().replace(/\s+/g, ' ');
            if (normalized.length < MIN_LINE_LENGTH_FOR_REPEAT_DETECTION)
                continue;
            if (seenOnPage.has(normalized))
                continue;
            seenOnPage.add(normalized);
            let set = lineToPages.get(normalized);
            if (!set) {
                set = new Set();
                lineToPages.set(normalized, set);
            }
            set.add(p);
        }
    }
    const strip = new Set();
    const thresholdPages = Math.max(2, Math.ceil(pageCount * pageRatioThreshold));
    for (const [line, pages] of lineToPages) {
        if (pages.size >= thresholdPages)
            strip.add(line);
    }
    if (strip.size > 0) {
        legalDocLog.info('Removed suspected repeated header/footer lines', {
            count: strip.size,
            thresholdPages,
            sample: [...strip].slice(0, 5),
        });
    }
    return pageLines.map((lines) => lines.filter((l) => {
        const normalized = l.trim().replace(/\s+/g, ' ');
        return !strip.has(normalized);
    }));
}
/**
 * Join soft-wrapped fragments: hyphen breaks and lowercase continuations.
 */
function repairBrokenWrapping(lines) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        let current = lines[i];
        if (!current.trim()) {
            out.push('');
            continue;
        }
        while (i + 1 < lines.length) {
            const next = lines[i + 1];
            if (!next.trim())
                break;
            const trimmed = current.trimEnd();
            const hyphenSplit = trimmed.endsWith('-') && /^[a-z]/.test(next.trim());
            const softWrap = !/[.!?:]\s*$/.test(trimmed) &&
                /^[a-z(\u201c]/.test(next.trim()) &&
                trimmed.length > 0 &&
                !/^\d+(?:\.\d+)*(?:\([^)]+\))*$/.test(trimmed);
            if (hyphenSplit) {
                current =
                    trimmed.slice(0, -1).trimEnd() +
                        next.trimStart();
                i++;
                continue;
            }
            if (softWrap) {
                current = trimmed + ' ' + next.trimStart();
                i++;
                continue;
            }
            break;
        }
        out.push(current);
    }
    return out;
}
function pagesToCleanedText(pages, repeatedLinePageRatio) {
    const pageLineArrays = pages.map((p) => repairBrokenWrapping(splitLines(p.text)));
    const withoutRepeat = stripRepeatedLinesAcrossPages(pageLineArrays, repeatedLinePageRatio);
    const parts = [];
    for (let i = 0; i < withoutRepeat.length; i++) {
        const block = withoutRepeat[i].join('\n');
        parts.push(block);
    }
    return parts.join('\n\n');
}
/**
 * Loads text from a PDF using `pdf-parse` (per-page extraction, then cleanup).
 */
export function createPdfParseLoader(options = {}) {
    const repeatedLinePageRatio = options.repeatedLinePageRatio ?? DEFAULT_HEADER_FOOTER_PAGE_RATIO;
    return {
        async load(path) {
            const buffer = await readFile(path);
            const parser = new PDFParse({ data: buffer });
            try {
                const result = await parser.getText({
                    lineEnforce: true,
                    pageJoiner: '',
                });
                const cleaned = normalizeWhitespace(pagesToCleanedText(result.pages, repeatedLinePageRatio));
                legalDocLog.debug('PDF text extraction summary', {
                    pages: result.total,
                    chars: cleaned.length,
                });
                return cleaned;
            }
            finally {
                await parser.destroy();
            }
        },
    };
}
//# sourceMappingURL=pdf-parse-loader.js.map