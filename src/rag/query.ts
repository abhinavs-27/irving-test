/**
 * Full RAG query pipeline:
 *   1. Decompose user question into sub-queries (local Ollama LLM)
 *   2. Retrieve clauses per sub-query (pgvector + boosts)
 *   3. Synthesize answer (local Ollama LLM)
 *
 * No API keys required. Requires Ollama running locally.
 */
import OpenAI from 'openai';
import { decomposeQuery, type SubQuery } from './decompose.js';
import { retrieveClauses, type ClauseHit } from './retrieve.js';

export type SubQueryResult = {
  subQuery: SubQuery;
  hits: ClauseHit[];
};

export type QueryResult = {
  question: string;
  subQueries: SubQueryResult[];
  answer: string;
  usage: { prompt_tokens: number; completion_tokens: number };
};

const SYNTHESIS_SYSTEM = `You are a legal agreement analyst. Answer the user's question using only the retrieved clause context provided.
- Be concise and precise
- Cite clause_ids when making specific claims
- Flag any gaps where retrieval found nothing relevant`;

let _client: OpenAI | undefined;
function client(): OpenAI {
  if (!_client) {
    const base = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
    _client = new OpenAI({ baseURL: `${base}/v1`, apiKey: 'ollama' });
  }
  return _client;
}

export async function query(userQuestion: string): Promise<QueryResult> {
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

  // Step 1: decompose
  const subQueries = await decomposeQuery(userQuestion);

  // Step 2: retrieve per sub-query (parallel)
  const subResults: SubQueryResult[] = await Promise.all(
    subQueries.map(async (sq) => ({
      subQuery: sq,
      hits: await retrieveClauses(sq.question, {
        clauseTypes: sq.clauseTypes.length > 0 ? sq.clauseTypes : undefined,
        limit: 5,
        minScore: 0.1,
      }),
    })),
  );

  // Step 3: build context for synthesis
  const context = subResults
    .map(({ subQuery, hits }) => {
      const hitLines = hits
        .map(
          (h, i) =>
            `[${i + 1}] clause_id=${h.clause_id} type=${h.clause_type} priority=${h.priority} score=${h.score.toFixed(3)}\n${h.summary}`,
        )
        .join('\n\n');
      return `### Sub-query: "${subQuery.question}"${subQuery.riskFocuses.length ? `\nRisk focuses: ${subQuery.riskFocuses.join(', ')}` : ''}\n\n${hitLines || '(no results above threshold)'}`;
    })
    .join('\n\n---\n\n');

  // Step 4: synthesize
  const res = await client().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: `${SYNTHESIS_SYSTEM}\n\nRetrieved clauses:\n\n${context}` },
      { role: 'user', content: `Question: ${userQuestion}` },
    ],
  });

  const answer = res.choices[0]?.message.content ?? '(no answer)';

  return {
    question: userQuestion,
    subQueries: subResults,
    answer,
    usage: {
      prompt_tokens: res.usage?.prompt_tokens ?? 0,
      completion_tokens: res.usage?.completion_tokens ?? 0,
    },
  };
}
