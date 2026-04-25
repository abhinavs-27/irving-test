/**
 * In-memory retrieval from the file-based vector store.
 * Scoring: cosine similarity + priority boost + cross-reference boost.
 */
import { readFileSync, existsSync } from 'node:fs';
import { embed } from './embed.js';
import { clausesPath, agreementsPath } from './db.js';
import type { ClauseType } from '../understanding/normalized-clause.js';
import type { StoredClause, StoredAgreement } from './ingest.js';

export type ClauseHit = {
  clause_id: string;
  clause_type: string;
  priority: string;
  confidence: number;
  primary_entity_id: string;
  summary: string;
  score: number;
};

export type AgreementHit = {
  agreement_id: string;
  primary_entity_id: string;
  summary: string;
  risk_flag_count: number;
  score: number;
};

export type RetrievalOptions = {
  clauseTypes?: ClauseType[];
  limit?: number;
  minScore?: number;
};

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na  += a[i]! * a[i]!;
    nb  += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function loadClauses(): StoredClause[] {
  const p = clausesPath();
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')) as StoredClause[];
}

function loadAgreements(): StoredAgreement[] {
  const p = agreementsPath();
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')) as StoredAgreement[];
}

export async function retrieveClauses(
  query: string,
  opts: RetrievalOptions = {},
): Promise<ClauseHit[]> {
  const { clauseTypes, limit = 10, minScore = 0.0 } = opts;

  const qEmb = await embed(query);
  let rows = loadClauses();

  if (clauseTypes && clauseTypes.length > 0) {
    rows = rows.filter((r) => clauseTypes.includes(r.clause_type as ClauseType));
  }

  const scored: ClauseHit[] = rows.map((r) => {
    const sim = cosine(qEmb, r.embedding);
    const priorityBoost = r.priority === 'high' ? 0.10 : r.priority === 'medium' ? 0.03 : 0;
    const xrefBoost = Math.min(r.cross_reference_count * 0.05, 0.15);
    return {
      clause_id: r.clause_id,
      clause_type: r.clause_type,
      priority: r.priority,
      confidence: r.confidence,
      primary_entity_id: r.primary_entity_id,
      summary: r.summary,
      score: sim + priorityBoost + xrefBoost,
    };
  });

  return scored
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function retrieveAgreements(
  query: string,
  limit = 5,
): Promise<AgreementHit[]> {
  const qEmb = await embed(query);
  const rows = loadAgreements();

  return rows
    .map((r) => ({
      agreement_id: r.agreement_id,
      primary_entity_id: r.primary_entity_id,
      summary: r.summary,
      risk_flag_count: r.risk_flag_count,
      score: cosine(qEmb, r.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
