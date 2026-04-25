/**
 * Agent-lite query decomposition via Ollama (local LLM, no API key).
 *
 * Breaks a user question like "Find issues" into typed sub-queries, each mapped
 * to specific clause types and risk flag codes for targeted retrieval.
 *
 * Requires: `ollama pull qwen2.5:7b` (or set OLLAMA_MODEL env var)
 */
import OpenAI from 'openai';
import type { ClauseType } from '../understanding/normalized-clause.js';

export type SubQuery = {
  question: string;
  clauseTypes: ClauseType[];
  riskFocuses: string[];
};

const SYSTEM = `You decompose legal agreement analysis questions into specific sub-queries for retrieval.
Output ONLY a JSON array with no extra text. Each element must have exactly these keys:
  "question":    string  — a focused retrieval question
  "clauseTypes": array   — subset of: structural, pricing_terms, constraint, termination, disclosure, obligation, indemnity, payment, other
  "riskFocuses": array   — subset of: purchase_discount_3pct_or_higher, broad_issuance_headroom, large_commitment_usd, short_termination_notice, low_layer2_confidence, pricing_inconsistency, agreement_date_inconsistency

Rules:
- Output 2–5 sub-queries
- Each sub-query targets one concern
- Prefer specific clauseTypes over empty arrays
- Output raw JSON array only, absolutely no markdown fences or explanation`;

let _client: OpenAI | undefined;
function client(): OpenAI {
  if (!_client) {
    const base = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
    _client = new OpenAI({ baseURL: `${base}/v1`, apiKey: 'ollama' });
  }
  return _client;
}

export async function decomposeQuery(userQuery: string): Promise<SubQuery[]> {
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

  const res = await client().chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userQuery },
    ],
  });

  const text = res.choices[0]?.message.content?.trim() ?? '[]';

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    return [{ question: userQuery, clauseTypes: [], riskFocuses: [] }];
  }

  try {
    const parsed = JSON.parse(match[0]) as SubQuery[];
    return parsed.map((sq) => ({
      question: sq.question ?? userQuery,
      clauseTypes: Array.isArray(sq.clauseTypes) ? sq.clauseTypes : [],
      riskFocuses: Array.isArray(sq.riskFocuses) ? sq.riskFocuses : [],
    }));
  } catch {
    return [{ question: userQuery, clauseTypes: [], riskFocuses: [] }];
  }
}
