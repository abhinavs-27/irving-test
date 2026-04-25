/**
 * File-based vector store — no database required.
 * Persists clause and agreement records (with embeddings) as JSON files under VECTOR_STORE_DIR.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function storeDir(): string {
  return process.env.VECTOR_STORE_DIR ?? './out/vector-store';
}

export function clausesPath(): string {
  return join(storeDir(), 'clauses.json');
}

export function agreementsPath(): string {
  return join(storeDir(), 'agreements.json');
}

export function ensureStoreDir(): void {
  mkdirSync(storeDir(), { recursive: true });
}
