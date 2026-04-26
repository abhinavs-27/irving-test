import type { PipelineLogEntry } from './types.js';

export function logStep(
  step: string,
  clauseId: string | undefined,
  startMs: number,
  result: string,
): PipelineLogEntry {
  const duration_ms = Date.now() - startMs;
  const tag = clauseId ? ` [${clauseId}]` : '';
  process.stderr.write(`  [${step}]${tag} ${duration_ms}ms — ${result}\n`);
  return { step, clause_id: clauseId, duration_ms, result };
}
