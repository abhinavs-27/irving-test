/**
 * Detect paragraph text that likely continues on the next PDF/layout fragment.
 */
export function paragraphEndsIncomplete(text) {
    const s = text.trimEnd();
    if (!s)
        return false;
    let depth = 0;
    for (const c of s) {
        if (c === '(')
            depth++;
        else if (c === ')')
            depth--;
    }
    if (depth > 0)
        return true;
    if (/[(]\s*$/.test(s))
        return true;
    if (/[,:\-–—]\s*$/.test(s))
        return true;
    if (/[.!?;)]["']?\s*$/.test(s))
        return false;
    const lastWord = s.match(/\b([\w'-]+)\s*$/)?.[1]?.toLowerCase();
    if (lastWord &&
        /^(the|a|an|to|of|by|from|for|with|at|in|on|as|it|or|and|but|if|when|that|which|issued|such|not|no|any|each|both|either)$/i.test(lastWord))
        return true;
    if (/\b(?:under|over|upon|into|onto)\s+$/i.test(s))
        return true;
    return false;
}
/**
 * Merge adjacent paragraph clauses when the first ends mid-sentence / mid-parenthesis.
 * Renumbers ids as `{sectionId}.p1`, … in order.
 */
export function mergeIncompleteParagraphs(sectionId, paras) {
    if (paras.length <= 1)
        return renumberIds(sectionId, paras);
    const merged = [];
    let i = 0;
    while (i < paras.length) {
        let text = paras[i].text;
        let j = i;
        while (j + 1 < paras.length && paragraphEndsIncomplete(text)) {
            j++;
            text = `${text} ${paras[j].text}`.replace(/\s+/g, ' ').trim();
        }
        merged.push({
            ...paras[i],
            text,
        });
        i = j + 1;
    }
    return renumberIds(sectionId, merged);
}
function renumberIds(sectionId, paras) {
    return paras.map((p, idx) => ({
        ...p,
        id: `${sectionId}.p${idx + 1}`,
    }));
}
//# sourceMappingURL=paragraph-integrity.js.map