/**
 * Ingest Layer 2 + Layer 3 data into the file-based vector store.
 *
 *   npm run rag:ingest -- --clauses=./out/understanding.json --agreements=./out/agreements.json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ClauseBlock } from './understanding/normalized-clause.js';
import type { Agreement } from './understanding/layer3-agreement.js';
import { ingestClauses, ingestAgreements } from './rag/ingest.js';

function parseArgs(argv: string[]): { clausesPath?: string; agreementsPath?: string } {
  let clausesPath: string | undefined;
  let agreementsPath: string | undefined;
  for (const a of argv) {
    if (a.startsWith('--clauses=')) clausesPath = a.slice('--clauses='.length);
    else if (a.startsWith('--agreements=')) agreementsPath = a.slice('--agreements='.length);
  }
  return { clausesPath, agreementsPath };
}

const { clausesPath, agreementsPath } = parseArgs(process.argv.slice(2));

if (!clausesPath && !agreementsPath) {
  console.error(`
Usage:
  npm run rag:ingest -- --clauses=<path> [--agreements=<path>]

Both flags are optional but at least one must be supplied.
`);
  process.exit(1);
}

if (clausesPath) {
  const clauses = JSON.parse(readFileSync(resolve(clausesPath), 'utf8')) as ClauseBlock[];
  if (!Array.isArray(clauses)) throw new Error('--clauses must be a JSON array');
  await ingestClauses(clauses);
}

if (agreementsPath) {
  const agreements = JSON.parse(readFileSync(resolve(agreementsPath), 'utf8')) as Agreement[];
  if (!Array.isArray(agreements)) throw new Error('--agreements must be a JSON array');
  await ingestAgreements(agreements);
}

process.stderr.write('[rag:ingest] done\n');
