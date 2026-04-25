/**
 * Ingest Layer 2 ClauseBlocks and Layer 3 Agreements into the file-based vector store.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { embedBatch, pgVector } from './embed.js';
import { summarizeClause, crossReferenceCount } from './summarize-clause.js';
import { summarizeAgreement } from '../understanding/layer3-agreement.js';
import { ensureStoreDir, clausesPath, agreementsPath } from './db.js';
import type { ClauseBlock } from '../understanding/normalized-clause.js';
import type { Agreement } from '../understanding/layer3-agreement.js';

export type StoredClause = {
  clause_id: string;
  clause_type: string;
  priority: string;
  confidence: number;
  primary_entity_id: string;
  summary: string;
  cross_reference_count: number;
  embedding: number[];
};

export type StoredAgreement = {
  agreement_id: string;
  primary_entity_id: string;
  risk_flag_count: number;
  summary: string;
  embedding: number[];
};

function loadJson<T>(path: string, fallback: T[]): T[] {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T[];
  } catch {
    return fallback;
  }
}

export async function ingestClauses(clauses: ClauseBlock[]): Promise<void> {
  if (clauses.length === 0) return;
  ensureStoreDir();

  const summaries = clauses.map(summarizeClause);
  const embeddings = await embedBatch(summaries);

  const existing = loadJson<StoredClause>(clausesPath(), []);
  const byId = new Map(existing.map((c) => [c.clause_id, c]));

  for (let i = 0; i < clauses.length; i++) {
    const c = clauses[i]!;
    byId.set(c.clause_id, {
      clause_id: c.clause_id,
      clause_type: c.clause_type,
      priority: c.priority,
      confidence: c.confidence,
      primary_entity_id: c.primary_entity_id,
      summary: summaries[i]!,
      cross_reference_count: crossReferenceCount(c),
      embedding: embeddings[i]!,
    });
  }

  writeFileSync(clausesPath(), JSON.stringify([...byId.values()], null, 2));
  process.stderr.write(`[ingest] ${clauses.length} clause(s) → ${clausesPath()}\n`);
}

export async function ingestAgreements(agreements: Agreement[]): Promise<void> {
  if (agreements.length === 0) return;
  ensureStoreDir();

  const summaries = agreements.map(summarizeAgreement);
  const embeddings = await embedBatch(summaries);

  const existing = loadJson<StoredAgreement>(agreementsPath(), []);
  const byId = new Map(existing.map((a) => [a.agreement_id, a]));

  for (let i = 0; i < agreements.length; i++) {
    const a = agreements[i]!;
    byId.set(a.agreement_id, {
      agreement_id: a.agreement_id,
      primary_entity_id: a.primary_entity_id,
      risk_flag_count: a.risk_flags.length,
      summary: summaries[i]!,
      embedding: embeddings[i]!,
    });
  }

  writeFileSync(agreementsPath(), JSON.stringify([...byId.values()], null, 2));
  process.stderr.write(`[ingest] ${agreements.length} agreement(s) → ${agreementsPath()}\n`);
}
