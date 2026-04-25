/**
 * Ollama embeddings via its OpenAI-compatible API.
 * Model: nomic-embed-text (768-dim). No API key required.
 * Requires Ollama running: `ollama serve` + `ollama pull nomic-embed-text`
 */
import OpenAI from 'openai';

export const EMBEDDING_DIM = 768;
const MODEL = 'nomic-embed-text';
const MAX_CHARS = 8_000;

let _client: OpenAI | undefined;
function client(): OpenAI {
  if (!_client) {
    const base = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
    _client = new OpenAI({ baseURL: `${base}/v1`, apiKey: 'ollama' });
  }
  return _client;
}

export async function embed(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: MODEL,
    input: text.slice(0, MAX_CHARS),
  });
  return res.data[0]!.embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  // Ollama processes one at a time through the embeddings endpoint
  const results = await Promise.all(texts.map((t) => embed(t)));
  return results;
}

/** Format a float[] as the pgvector literal pgvector expects: '[x,y,...]' */
export function pgVector(v: number[]): string {
  return `[${v.join(',')}]`;
}
