/**
 * Step 3 — Aggregate clause-level issues and find agreement-level gaps.
 *
 * Two jobs:
 *   a) Dedup issues that are semantically the same across clauses.
 *   b) Ask the LLM what important clause types are entirely absent from
 *      the agreement (e.g. no governing law, no dispute resolution).
 */
import type { ClauseBlock } from '../understanding/normalized-clause.js';
import type { Agreement } from '../understanding/layer3-agreement.js';
import type { ClauseIssue } from './types.js';
import { chat, extractJson } from './llm.js';

const SYSTEM = `You review an agreement as a whole to find gaps not visible in individual clauses.
Look for important clause types that are completely absent (e.g. no governing law, no dispute
resolution, no limitation of liability, no representations and warranties, no confidentiality).

For each gap output:
{
  "issue":          string,
  "clause_id":      "agreement",
  "clause_type":    "agreement",
  "severity":       "low"|"medium"|"high"|"critical",
  "reason":         string,
  "recommendation": string,
  "category":       "missing_protection"|"risky_term"|"inconsistency"|"vague_language"|"asymmetric_obligation"|"other"
}

Output a JSON array. Output [] if no gaps.
Output raw JSON only.`;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function deduplicate(issues: ClauseIssue[]): ClauseIssue[] {
  const seen = new Set<string>();
  const out: ClauseIssue[] = [];
  for (const issue of issues) {
    const key = normalize(issue.issue);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(issue);
    }
  }
  return out;
}

export async function aggregateIssues(
  clauseIssues: ClauseIssue[],
  clauses: readonly ClauseBlock[],
  agreement: Agreement,
): Promise<ClauseIssue[]> {
  const presentTypes = [...new Set(clauses.map((c) => c.clause_type))].sort();
  const riskSummary = agreement.risk_flags
    .map((f) => `[${f.severity}] ${f.code}`)
    .join(', ');

  const text = await chat(
    SYSTEM,
    `Agreement: ${agreement.agreement_id}
Clause types present: ${presentTypes.join(', ')}
Risk flags already detected: ${riskSummary || 'none'}
Issues already found across clauses: ${clauseIssues.length}`,
  );

  const agreementLevel = extractJson<ClauseIssue[]>(text, []);
  const combined = [
    ...clauseIssues,
    ...(Array.isArray(agreementLevel) ? agreementLevel : []),
  ];

  return deduplicate(combined);
}
