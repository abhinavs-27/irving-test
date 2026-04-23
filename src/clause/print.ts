import type { Clause } from './clause.js';

/**
 * Prints id and title only (readable outline). Bodies are omitted.
 */
export function printClauseTree(clauses: Clause[], depth = 0): void {
  for (const c of clauses) {
    const pad = '  '.repeat(depth);
    const title = c.title.trim();
    const line = title ? `${pad}${c.id} ${title}` : `${pad}${c.id}`;
    console.log(line);
    printClauseTree(c.children, depth + 1);
  }
}
