/**
 * Prints id and title only (readable outline). Bodies are omitted.
 */
export function printClauseTree(clauses, depth = 0) {
    for (const c of clauses) {
        const pad = '  '.repeat(depth);
        const title = c.title.trim();
        const line = title ? `${pad}${c.id} ${title}` : `${pad}${c.id}`;
        console.log(line);
        printClauseTree(c.children, depth + 1);
    }
}
//# sourceMappingURL=print.js.map