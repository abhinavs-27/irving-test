/**
 * Merge false `\n\n` paragraph breaks introduced by PDF layout when the prior block
 * clearly continues mid-sentence (stream-safe; does not split on `.` inside abbreviations).
 */
function endsWithIncompleteSentence(s) {
    const t = s.trimEnd();
    if (t.length === 0)
        return false;
    const last = t.slice(-1);
    if (/[.!?:;]$/.test(last))
        return false;
    // Single-letter line-end often hyphenated wrap — treat as incomplete
    if (/[^.!?;:]\s+[A-Z]\.?$/.test(t))
        return true;
    return true;
}
function startsLikeContinuation(s) {
    const t = s.trimStart();
    if (t.length === 0)
        return false;
    const c = t[0];
    if (c === '(' || c === '[' || c === '"' || c === "'")
        return true;
    if (/[a-z]/.test(c))
        return true;
    // Continuation after "by B." style wrap — next token continues name
    if (/^Riley|^Capital|^Principal|^Financial|^Securities|^under\s|^and\s|^or\s|^to\s|^of\s|^the\s+[a-z]/i.test(t))
        return true;
    return false;
}
/**
 * Join adjacent `\n\n` blocks when the first does not end a sentence boundary and the
 * second looks like a grammatical continuation (lowercase lead, quotation, etc.).
 */
export function mergeSoftParagraphBreaks(raw) {
    const chunks = raw.split(/\n\s*\n+/).map((c) => c.trim()).filter(Boolean);
    if (chunks.length <= 1)
        return raw.trim();
    const out = [];
    for (const chunk of chunks) {
        if (out.length === 0) {
            out.push(chunk);
            continue;
        }
        const prev = out[out.length - 1];
        if (endsWithIncompleteSentence(prev) &&
            startsLikeContinuation(chunk)) {
            out[out.length - 1] = `${prev} ${chunk}`;
        }
        else {
            out.push(chunk);
        }
    }
    return out.join('\n\n').trim();
}
//# sourceMappingURL=merge-paragraph-glue.js.map