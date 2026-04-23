import type { ClauseUnderstandingRecord } from './types.js';
import { parseSectionIdFromClauseId } from './section-context.js';
import type { ClauseWork } from './dedupe-merge.js';

/**
 * One semantic block per **contiguous run** of same `(section_id, clause_type)` in document order.
 * Each clause appears in exactly one block; ids are stable per section (`{section}.sb{n}`).
 */
export function assignSemanticBlocks(rows: ClauseWork[]): ClauseUnderstandingRecord[] {
  const blockCounter = new Map<string, number>();
  let prevSig: string | null = null;
  let currentBlockId = '';

  const out: ClauseUnderstandingRecord[] = [];

  for (const w of rows) {
    const sec = parseSectionIdFromClauseId(w.record.clause_id);
    const ty = w.record.clause_type;
    const sig = `${sec}|${ty}`;

    if (sig !== prevSig) {
      const n = (blockCounter.get(sec) ?? 0) + 1;
      blockCounter.set(sec, n);
      currentBlockId = `${sec}.sb${n}`;
      prevSig = sig;
    }

    out.push({
      ...w.record,
      semantic_block_id: currentBlockId,
      debug: {
        ...w.record.debug,
        block_assignment_reason: `adjacent_run:section=${sec};clause_type=${ty};block=${currentBlockId}`,
      },
    });
  }

  return out;
}
