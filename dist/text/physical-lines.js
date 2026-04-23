/**
 * Iterate physical lines with the character index where each line begins in `text`.
 */
export function* eachPhysicalLine(text) {
    let p = 0;
    while (p < text.length) {
        const lineStart = p;
        const nl = text.indexOf('\n', p);
        const end = nl === -1 ? text.length : nl;
        const line = text.slice(p, end);
        if (nl === -1) {
            yield { lineStart, line };
            return;
        }
        p = nl + 1;
        yield { lineStart, line };
    }
}
//# sourceMappingURL=physical-lines.js.map