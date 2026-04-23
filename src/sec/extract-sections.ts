import type { Clause, ClauseType } from '../clause/clause.js';
import { legalDocLog } from '../logging.js';
import { eachPhysicalLine } from '../text/physical-lines.js';
import { parseFilingHeader } from './parse-filing-header.js';
import { splitIntoParagraphs } from './split-paragraphs.js';

/**
 * SEC 8-K / 10-Q style "Item N.NN Title" (line-anchored, case-insensitive).
 * Title comes only from this match — never inferred from following lines.
 */
const SEC_ITEM_HEADER = /^Item\s+(\d+\.\d+)\s+(.*)$/i;

/** Footer / signature block (start of line). */
const SEC_FOOTER_LINE =
  /^(SIGNATURES?|Pursuant to the requirements of the Securities Exchange Act)/i;

export type SecItemMatch = {
  id: string;
  title: string;
  start: number;
};

function emptyClause(
  id: string,
  title: string,
  text: string,
  type: ClauseType,
): Clause {
  return { id, title, text, type, children: [] };
}

/** Pass 1: Item headers only (titles from regex capture only). */
function detectSecItems(text: string): SecItemMatch[] {
  const matches: SecItemMatch[] = [];

  for (const { lineStart, line } of eachPhysicalLine(text)) {
    const content = line.replace(/\r$/, '').trimStart();
    if (!content) continue;

    const m = SEC_ITEM_HEADER.exec(content);
    if (!m) continue;

    const id = m[1].trim();
    const title = (m[2] ?? '').trim();

    matches.push({
      id,
      title,
      start: lineStart,
    });

    legalDocLog.debug('SEC Item header match', {
      id,
      title: title.slice(0, 120),
      start: lineStart,
    });
  }

  return matches;
}

/**
 * Last line in document order that matches footer pattern and lies at/after `minStart`.
 * Restricting to the tail avoids matching stray "Pursuant..." in the cover page.
 */
function findFooterStart(text: string, minStart: number): number | null {
  let last: number | null = null;
  for (const { lineStart, line } of eachPhysicalLine(text)) {
    if (lineStart < minStart) continue;
    const trimmed = line.replace(/\r$/, '').trim();
    if (!trimmed) continue;
    if (SEC_FOOTER_LINE.test(trimmed)) last = lineStart;
  }
  return last;
}

/**
 * Semantic segmentation for SEC filings: metadata header, Item N.NN sections, signature/footer.
 * Uses two passes: detect headers with offsets, then slice text. Titles only from Item lines.
 */
export function extractSections(text: string): Clause[] {
  const rawMatches = detectSecItems(text);
  const items = [...rawMatches].sort((a, b) => a.start - b.start);

  const seenIds = new Map<string, number>();
  for (const m of items) {
    seenIds.set(m.id, (seenIds.get(m.id) ?? 0) + 1);
  }
  const dupIds = [...seenIds.entries()].filter(([, n]) => n > 1);
  if (dupIds.length > 0) {
    legalDocLog.warn(
      'Multiple line breaks for same Item number (e.g. TOC + body); keeping each segment',
      { duplicateItemNumbers: dupIds.map(([id, n]) => ({ id, segments: n })) },
    );
  }

  const lastItemStart =
    items.length > 0 ? items[items.length - 1]!.start : 0;
  const footerStart = findFooterStart(text, lastItemStart);

  legalDocLog.info('SEC extractSections: detected Item headers', {
    count: items.length,
    items: items.map((m) => ({
      id: m.id,
      title: m.title,
      start: m.start,
    })),
  });

  if (items.length > 0) {
    legalDocLog.info(
      `Detected sections:\n${items
        .map((m) => `  • ${m.id} ${m.title}`.trimEnd())
        .join('\n')}`,
    );
  }

  const sections: Clause[] = [];

  const firstItemStart = items[0]?.start ?? text.length;
  const headerEnd = Math.min(
    firstItemStart,
    footerStart ?? text.length,
  );
  const headerText = text.slice(0, headerEnd).trim();
  if (headerText.length > 0 || firstItemStart > 0) {
    const filingHeader = parseFilingHeader(headerText);
    sections.push({
      ...emptyClause('header', '', '', 'metadata'),
      filingHeader,
    });
  }

  for (let i = 0; i < items.length; i++) {
    const cur = items[i]!;
    const next = items[i + 1];
    let end = next ? next.start : text.length;
    if (footerStart !== null && footerStart > cur.start && footerStart < end) {
      end = footerStart;
    }
    const body = text.slice(cur.start, end).trim();
    sections.push(emptyClause(cur.id, cur.title, body, 'section'));
  }

  if (footerStart !== null) {
    const footerText = text.slice(footerStart).trim();
    if (footerText.length > 0) {
      sections.push(
        emptyClause('signature', '', footerText, 'footer'),
      );
    }
  }

  legalDocLog.info('extractSections: built segments', {
    segmentCount: sections.length,
    ids: sections.map((s) => s.id),
    types: sections.map((s) => s.type),
  });

  return sections;
}

/** Prefer `splitIntoParagraphs`; contract clause parsing can extend this later. */
export function parseSectionInnerClauses(section: Clause): Clause[] {
  return splitIntoParagraphs(section);
}
