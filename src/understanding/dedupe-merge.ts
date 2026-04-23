import type { ClauseUnderstandingRecord } from './types.js';
import { parseSectionIdFromClauseId } from './section-context.js';

export type ClauseWork = {
  record: ClauseUnderstandingRecord;
  text: string;
};

function tokenize(text: string): Set<string> {
  const raw = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(raw);
}

/** Jaccard similarity on word sets (deterministic). */
export function tokenJaccardSimilarity(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function oneContainsCoreOfOther(shorter: string, longer: string): boolean {
  const s = shorter.replace(/\s+/g, ' ').trim();
  const l = longer.replace(/\s+/g, ' ').trim();
  if (s.length < 40 || l.length < 40) return false;
  const core = s.slice(0, Math.min(72, s.length));
  return l.includes(core);
}

/**
 * Merge rows with same section + clause_type when text overlaps strongly (≥80% Jaccard or substring core).
 * Survivor is the earlier document-order row; merged clause ids captured in `debug.merged_with`.
 */
export function dedupeUnderstandingRecords(rows: ClauseWork[]): ClauseWork[] {
  const absorb = new Set<string>();
  const mergedInto = new Map<string, string[]>();

  for (let i = 0; i < rows.length; i++) {
    if (absorb.has(rows[i].record.clause_id)) continue;
    const idI = rows[i].record.clause_id;
    const secI = parseSectionIdFromClauseId(idI);
    let textI = rows[i].text;

    for (let j = i + 1; j < rows.length; j++) {
      if (absorb.has(rows[j].record.clause_id)) continue;
      const idJ = rows[j].record.clause_id;
      const secJ = parseSectionIdFromClauseId(idJ);
      if (secI !== secJ) continue;
      if (rows[i].record.clause_type !== rows[j].record.clause_type) continue;

      const jacc = tokenJaccardSimilarity(textI, rows[j].text);
      const sub =
        textI.length >= rows[j].text.length
          ? oneContainsCoreOfOther(rows[j].text, textI)
          : oneContainsCoreOfOther(textI, rows[j].text);

      if (jacc >= 0.8 || (jacc >= 0.65 && sub)) {
        absorb.add(idJ);
        const list = mergedInto.get(idI) ?? [];
        list.push(idJ);
        mergedInto.set(idI, list);
        if (rows[j].text.length > textI.length) {
          textI = rows[j].text;
          rows[i] = { ...rows[i], text: textI };
        }
      }
    }
  }

  const out: ClauseWork[] = [];
  for (const w of rows) {
    if (absorb.has(w.record.clause_id)) continue;
    const merged = mergedInto.get(w.record.clause_id);
    const m = merged ?? [];
    const rec: ClauseUnderstandingRecord = {
      ...w.record,
      debug: {
        ...w.record.debug,
        merged_with: m,
        deduped_from: m,
      },
    };
    out.push({ record: rec, text: w.text });
  }

  return out;
}
