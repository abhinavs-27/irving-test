/**
 * Step 2 — Check a single clause for issues.
 *
 * Uses the clause summary plus the risk_focus from the classify step to
 * find specific, actionable problems. Returns a list of issues, or [] if clean.
 */
import type { ClauseBlock } from '../understanding/normalized-clause.js';
import type { ClauseClassification, ClauseIssue } from './types.js';
import { chat, extractJson } from './llm.js';

const SYSTEM = `You are a legal analyst reviewing a contract clause for issues.
For each problem found output a JSON object:
{
  "issue":          string,   // title under 8 words
  "severity":       "low"|"medium"|"high"|"critical",
  "reason":         string,   // one sentence: why this matters
  "recommendation": string,   // one sentence: what to do
  "category":       "missing_protection"|"risky_term"|"inconsistency"|"vague_language"|"asymmetric_obligation"|"other"
}

Output a JSON array. Output [] if the clause has no issues.
Output raw JSON only — no markdown, no explanation outside the array.`;

type RawIssue = Omit<ClauseIssue, 'clause_id' | 'clause_type'>;

export async function checkClause(
  c: ClauseBlock,
  summary: string,
  classification: ClauseClassification,
): Promise<ClauseIssue[]> {
  const focusLine =
    classification.risk_focus.length > 0
      ? `\nFocus on: ${classification.risk_focus.join(', ')}`
      : '';

  const text = await chat(SYSTEM, `Clause: ${c.clause_id} (${c.clause_type})${focusLine}\n\n${summary}`);

  const parsed = extractJson<RawIssue[]>(text, []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item) => typeof item?.issue === 'string' && item.issue.length > 0)
    .map((item) => ({
      issue: item.issue,
      clause_id: c.clause_id,
      clause_type: c.clause_type,
      severity: (['low', 'medium', 'high', 'critical'] as const).includes(
        item.severity as ClauseIssue['severity'],
      )
        ? (item.severity as ClauseIssue['severity'])
        : 'medium',
      reason: item.reason ?? '',
      recommendation: item.recommendation ?? '',
      category: (
        [
          'missing_protection',
          'risky_term',
          'inconsistency',
          'vague_language',
          'asymmetric_obligation',
          'other',
        ] as const
      ).includes(item.category as ClauseIssue['category'])
        ? (item.category as ClauseIssue['category'])
        : 'other',
    }));
}
