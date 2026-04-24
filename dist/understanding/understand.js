export function collectParagraphClauses(sections) {
    const out = [];
    const walk = (n) => {
        if (n.type === 'paragraph')
            out.push(n);
        for (const c of n.children)
            walk(c);
    };
    for (const s of sections)
        walk(s);
    return out;
}
export { buildLayer1FilingInput, projectNormalizedClausesFromLayer1, } from './layer2-from-layer1.js';
//# sourceMappingURL=understand.js.map