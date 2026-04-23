/**
 * Classify dominant **substantive** legal intent only. Returns `null` when no signal
 * (caller should fall back toward misc.noise via confidence / heuristics).
 */
const SIGNALS = {
    pricing_terms: {
        keywords: [
            /\bVWAP\b/i,
            /\b(?:per share|purchase price)\b/i,
            /\bdiscount\b.*\b(?:purchase|price|VWAP|shares)\b/i,
            /\bstock price cap\b/i,
            /\bcap\s+price\b/i,
            /\bintraday trading day\b/i,
        ],
        boost: 1,
    },
    payment: {
        keywords: [
            /\b(?:wire transfer|closing payment|purchase price|funding|escrow)\b/i,
            /\bpay(?:able)?\s+\$\d/i,
            /\bfee(?:s)?\s+of\s+\$\d/i,
            /\bgross proceeds\b/i,
            /\bpay(?:ment)?s?\s+(?:will|shall)\s+be\b/i,
        ],
        boost: 1,
    },
    obligations: {
        keywords: [
            /\bshall\s+(?:timely\s+)?(?:file|notify|deliver|use\s+commercially\s+reasonable\s+efforts)\b/i,
            /\bdeliver(?:y|ies)?\s+of\s+shares\b/i,
            /\bcure\s+notice\b/i,
            /\breasonable\s+best\s+efforts\b/i,
        ],
        boost: 1,
    },
    termination: {
        keywords: [
            /\bterminat(?:e|ion)\b/i,
            /\bbankruptcy\b/i,
            /\bEvent of Default\b/i,
            /\b30-day cure period\b/i,
            /\bautomatically terminate\b/i,
            /\bmaterial adverse effect\b/i,
        ],
        boost: 1,
    },
    indemnity: {
        keywords: [
            /\bindemnif(?:y|ication)\b/i,
            /\bthird[- ]party\s+claims\b/i,
            /\bbasket\b/i,
            /\bthreshold\b.*\$\d/i,
            /\bsurvival\b.*\bindemn/i,
        ],
        boost: 1,
    },
    constraints: {
        keywords: [
            /\bstandstill\b/i,
            /\brestrict(?:ion|ed)\s+(?:transfer|sale)\b/i,
            /\bprior\s+written\s+consent\b/i,
            /\btransfer\s+restrictions\b/i,
            /\bgoverning\s+documents\b/i,
        ],
        boost: 1,
    },
    confidentiality: {
        keywords: [
            /\bconfidential(?:ity)?\b/i,
            /\bnon[- ]disclosure\b/i,
            /\bnon[- ]disparagement\b/i,
            /\bNDA\b/i,
            /\btrade secrets\b/i,
        ],
        boost: 1,
    },
};
export function classifyDominant(text) {
    const scores = new Map();
    for (const type of Object.keys(SIGNALS)) {
        const sig = SIGNALS[type];
        let score = 0;
        for (const rx of sig.keywords) {
            if (rx.test(text))
                score += sig.boost;
        }
        scores.set(type, score);
    }
    let bestType = null;
    let bestScore = 0;
    for (const [type, score] of scores) {
        if (score > bestScore) {
            bestScore = score;
            bestType = type;
        }
    }
    if (bestScore === 0 || bestType === null)
        return null;
    const runnersUp = [...scores.entries()].filter(([t, s]) => t !== bestType && s === bestScore);
    if (runnersUp.length > 0)
        return null;
    return bestType;
}
export function classificationStrength(text) {
    const dominant = classifyDominant(text);
    if (!dominant)
        return 0;
    const scores = new Map();
    for (const type of Object.keys(SIGNALS)) {
        const sig = SIGNALS[type];
        let score = 0;
        for (const rx of sig.keywords) {
            if (rx.test(text))
                score += sig.boost;
        }
        scores.set(type, score);
    }
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted[0]?.[1] ?? 0;
    const second = sorted[1]?.[1] ?? 0;
    const separation = top - second;
    const denom = Math.max(1, top + second);
    const normalizedSeparation = separation / denom;
    const kwHits = SIGNALS[dominant].keywords.filter((rx) => rx.test(text)).length;
    const normalizedHits = kwHits / SIGNALS[dominant].keywords.length;
    return Math.min(1, normalizedSeparation * 0.6 + normalizedHits * 0.4);
}
//# sourceMappingURL=classifier.js.map