import { normalizeClauseId, validateClauseId } from './clause-id.js';
import { legalDocLog } from '../logging.js';
import { eachPhysicalLine } from '../text/physical-lines.js';
/**
 * Clause ID at the beginning of a line (after optional indentation).
 * Optional "Section"; dotted decimals; nested "(...)" segments e.g. (a)(ii).
 */
const LINE_CLAUSE_HEADER = /^(Section\s+)?(\d+(?:\.\d+)*(?:\([^)]+\))*)\s*[:\-.–—]?\s*(.*)$/;
/**
 * Pass 1 — scan physical lines; only headers anchored at (indent-adjusted) line start match.
 */
function detectClauseHeaders(text) {
    const matches = [];
    for (const { lineStart, line } of eachPhysicalLine(text)) {
        const withoutTrailingCr = line.replace(/\r$/, '');
        const content = withoutTrailingCr.trimStart();
        if (!content)
            continue;
        const m = LINE_CLAUSE_HEADER.exec(content);
        if (!m)
            continue;
        const rawId = m[2];
        const title = (m[3] ?? '').trim();
        const id = normalizeClauseId(rawId);
        validateClauseId(id, 'clause header line scan');
        matches.push({
            id,
            title,
            start: lineStart,
        });
        legalDocLog.debug('Clause header line match', {
            id,
            title: title.slice(0, 80),
            start: lineStart,
        });
    }
    return matches;
}
/**
 * Pass 2 — order by position; slice `[start, nextStart)`; trim.
 */
function assignClauseBodies(text, matches) {
    const sorted = [...matches].sort((a, b) => a.start - b.start);
    const clauses = [];
    const idCounts = new Map();
    for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        const end = next ? next.start : text.length;
        const raw = text.slice(cur.start, end);
        const body = raw.trim();
        idCounts.set(cur.id, (idCounts.get(cur.id) ?? 0) + 1);
        const dup = clauses.some((c) => c.id === cur.id);
        if (dup) {
            legalDocLog.warn('Suspicious: duplicate clause id (appending body to prior entry)', {
                id: cur.id,
                startsAt: cur.start,
            });
            const prev = clauses.find((c) => c.id === cur.id);
            if (prev) {
                prev.text = `${prev.text}\n\n${body}`.trim();
            }
            continue;
        }
        clauses.push({
            id: cur.id,
            title: cur.title,
            text: body,
            type: 'paragraph',
            children: [],
        });
    }
    const duplicates = [...idCounts.entries()].filter(([, n]) => n > 1);
    if (duplicates.length > 0) {
        legalDocLog.warn('Suspicious: duplicate clause ids in document', {
            ids: duplicates.map(([id, n]) => ({ id, occurrences: n })),
        });
    }
    return clauses;
}
/**
 * Two-pass extraction: (1) line-anchored header matches with offsets; (2) slice text between headers.
 * Biased toward recall; refine precision with filters/logging later.
 */
export function extractClauses(text) {
    const matches = detectClauseHeaders(text);
    const allIds = matches.map((m) => m.id);
    legalDocLog.info('Pass 1: clause headers detected', {
        total: matches.length,
        first10Ids: allIds.slice(0, 10),
        allIds,
    });
    const clauses = assignClauseBodies(text, matches);
    legalDocLog.info('Pass 2: flat clauses built', {
        count: clauses.length,
        first10Ids: clauses.slice(0, 10).map((c) => c.id),
    });
    return clauses;
}
//# sourceMappingURL=extract.js.map