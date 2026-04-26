/**
 * Step 1 — Classify a clause to guide issue detection.
 *
 * Returns the specific risks to look for and whether the clause can be skipped
 * (e.g. a structural clause that only records a date has nothing to analyze).
 *
 * For clause types where risk is obvious from the type alone (structural with
 * no fields, empty `other`) we skip the LLM call entirely.
 */
import type { ClauseBlock } from '../understanding/normalized-clause.js';
import type { ClauseClassification } from './types.js';
import { chat, extractJson } from './llm.js';

const SYSTEM = `You classify a legal contract clause to guide issue detection.
Output JSON only:
{
  "risk_focus": string[],  // 2–4 specific things to look for when checking this clause for problems
  "skip": boolean          // true ONLY if the clause has no obligations, restrictions, or economic terms
}`;

function quickSkip(c: ClauseBlock): boolean {
  // Empty extracted_fields means no structured facts — skip if also a low-signal type
  const hasFields = Object.keys(c.extracted_fields).length > 0;
  if (!hasFields && (c.clause_type === 'structural' || c.clause_type === 'other')) return true;
  // obligations schema is always empty (Record<string, never>) — low signal
  if (c.clause_type === 'obligation' && !hasFields) return true;
  return false;
}

export async function classifyClause(
  c: ClauseBlock,
  summary: string,
): Promise<ClauseClassification> {
  if (quickSkip(c)) {
    return { clause_id: c.clause_id, clause_type: c.clause_type, risk_focus: [], skip: true };
  }

  const text = await chat(
    SYSTEM,
    `Clause: ${c.clause_id}\nType: ${c.clause_type}\nPriority: ${c.priority}\n\n${summary}`,
  );

  const parsed = extractJson<{ risk_focus?: string[]; skip?: boolean }>(text, {});

  return {
    clause_id: c.clause_id,
    clause_type: c.clause_type,
    risk_focus: Array.isArray(parsed.risk_focus) ? parsed.risk_focus : [],
    skip: parsed.skip === true,
  };
}
