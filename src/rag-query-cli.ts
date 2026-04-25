/**
 * Query the RAG system from the command line.
 *
 *   npm run rag:query -- "What are the risky clauses?"
 *   npm run rag:query -- "Find issues"
 */
import { query } from './rag/query.js';

const userQuestion = process.argv.slice(2).join(' ').trim();

if (!userQuestion) {
  console.error('Usage: npm run rag:query -- "<question>"');
  process.exit(1);
}

const result = await query(userQuestion);

// Print decomposition
process.stderr.write(`\n[decomposed into ${result.subQueries.length} sub-queries]\n`);
for (const { subQuery, hits } of result.subQueries) {
  process.stderr.write(`  • "${subQuery.question}" → ${hits.length} hit(s)`);
  if (subQuery.clauseTypes.length) {
    process.stderr.write(` [types: ${subQuery.clauseTypes.join(', ')}]`);
  }
  process.stderr.write('\n');
}

// Print answer
console.log('\n' + result.answer);

process.stderr.write(
  `\n[tokens: ${result.usage.prompt_tokens} prompt / ${result.usage.completion_tokens} completion]\n`,
);

;
