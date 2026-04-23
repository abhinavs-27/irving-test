const USD = 'USD';
const toUsd = (value) => ({ value, currency: USD });
function isItemOrExhibitOrRuleRef(text, n) {
    const t = text;
    if (/\bItem\s+1\.01\b/i.test(t) && Math.abs(n - 1.01) < 0.0001)
        return true;
    if (/\bItem\s+3\.02\b/i.test(t) && Math.abs(n - 3.02) < 0.0001)
        return true;
    if (/\bItem\s+9\.01\b/i.test(t) && Math.abs(n - 9.01) < 0.0001)
        return true;
    if (/\bExhibit\s+10\.1\b/i.test(t) && Math.abs(n - 10.1) < 0.0001)
        return true;
    if (/\bExhibit\s+10\.2\b/i.test(t) && Math.abs(n - 10.2) < 0.0001)
        return true;
    if (/\bRule\s+501\b/i.test(t) && n === 501)
        return true;
    if (/\bRule\s+506\b/i.test(t) && n === 506)
        return true;
    if (/\bSection\s+4\s*\(\s*a\s*\)\s*\(\s*2\s*\)/i.test(t) && n === 4)
        return true;
    if (/\bRegulation\s+D\b/i.test(t) && n === 13 && /\b13\s*\(d\)/i.test(t))
        return true;
    return false;
}
function uniqueSorted(nums) {
    return [...new Set(nums.filter((x) => Number.isFinite(x)))].sort((a, b) => a - b);
}
/**
 * v2 facts: normalized USD, structured time, ISO-ish dates, no exhibit/Item/Rule noise.
 */
export function buildNormalizedFactsForParagraph(text) {
    const empty = {
        percentages: [],
        dollar_amounts: [],
        share_counts: [],
        price_thresholds: [],
        dates: [],
        time_windows: [],
    };
    if (!text.trim())
        return empty;
    const t = text.replace(/\r/g, '');
    const percentages = [];
    for (const m of t.matchAll(/\b(\d+(?:\.\d+)?)\s*%(?![\d,.])/g)) {
        const n = Number.parseFloat(m[1]);
        if (Number.isFinite(n))
            percentages.push(n);
    }
    for (const m of t.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:percent|percentage)\b/gi)) {
        const n = Number.parseFloat(m[1]);
        if (Number.isFinite(n))
            percentages.push(n);
    }
    const rawDollars = [];
    for (const m of t.matchAll(/\$\s*([\d,]+(?:\.\d{1,4})?)\b/g)) {
        const n = Number.parseFloat(m[1].replace(/,/g, ''));
        if (Number.isFinite(n) && n > 0 && n < 1e15)
            rawDollars.push(n);
    }
    for (const m of t.matchAll(/\$\s*([\d,]+(?:\.\d+)?)\s*(Million|Billion|Thousand|MM|mm)\b/gi)) {
        const x = Number.parseFloat(m[1].replace(/,/g, ''));
        if (!Number.isFinite(x) || x <= 0)
            continue;
        const u = m[2].toLowerCase();
        const mult = u.startsWith('b') ? 1e9 : u === 'thousand' ? 1e3 : 1e6;
        if (x * mult < 1e15)
            rawDollars.push(x * mult);
    }
    const share_counts = [];
    for (const m of t.matchAll(/\b([\d,]+(?:\.\d+)?)\s+shares?\b/gi)) {
        const n = Number.parseFloat(m[1].replace(/,/g, ''));
        if (Number.isFinite(n) && n > 0)
            share_counts.push(n);
    }
    const rawPrice = [];
    for (const m of t.matchAll(/(?:exercise|purchase|closing|offering)\s+price|price\s+per|per\s+share\)?\s*(?:of|at|is|not less than)?\s*[\$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?![\d,.]*\s*%)/gi)) {
        if (!m[1])
            continue;
        const n = Number.parseFloat(m[1].replace(/,/g, ''));
        if (Number.isFinite(n) && n > 0)
            rawPrice.push(n);
    }
    for (const m of t.matchAll(/not less than\s+\$?(\d+(?:\.\d+)?)(?![\d,.]*\s*%)/gi)) {
        const n = Number.parseFloat(m[1]);
        if (Number.isFinite(n) && n > 0)
            rawPrice.push(n);
    }
    const dateStrs = [];
    for (const m of t.matchAll(/\b(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\b/g)) {
        const a = m[1].split('/');
        if (a.length === 3) {
            const y = a[2].length === 2 ? `20${a[2]}` : a[2];
            dateStrs.push(`${y}-${a[0].padStart(2, '0')}-${a[1].padStart(2, '0')}`);
        }
    }
    for (const m of t.matchAll(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi)) {
        const d = new Date(m[1]);
        if (!Number.isNaN(d.getTime())) {
            dateStrs.push(d.toISOString().slice(0, 10));
        }
    }
    for (const m of t.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
        dateStrs.push(m[1]);
    }
    const time_windows = [];
    for (const m of t.matchAll(/\b(\d+)\s*[-\u2011]?\s*month/gi)) {
        const v = parseInt(m[1], 10);
        if (Number.isFinite(v))
            time_windows.push({ value: v, unit: 'month' });
    }
    for (const m of t.matchAll(/\b(\d+)\s*[-\u2011]?\s*year/gi)) {
        const v = parseInt(m[1], 10);
        if (Number.isFinite(v))
            time_windows.push({ value: v, unit: 'year' });
    }
    for (const m of t.matchAll(/(?:first|last|any|each|every|thirtieth|the)\s*\(?(\d+)(?:st|nd|rd|th)?\)?\s*trading\s+days?/gi)) {
        const v = parseInt(m[1], 10);
        if (Number.isFinite(v))
            time_windows.push({ value: v, unit: 'day' });
    }
    for (const m of t.matchAll(/\bten\s+business\s+days?/gi)) {
        time_windows.push({ value: 10, unit: 'day' });
    }
    for (const m of t.matchAll(/\bfifth\s+trading\s+day/gi)) {
        time_windows.push({ value: 5, unit: 'day' });
    }
    const twKey = (x) => `${x.value}|${x.unit}`;
    const seenTw = new Set();
    const timeWindowsDedup = [];
    for (const x of time_windows) {
        const k = twKey(x);
        if (seenTw.has(k))
            continue;
        seenTw.add(k);
        timeWindowsDedup.push(x);
    }
    const dollar_amounts = uniqueSorted(rawDollars)
        .filter((v) => !isItemOrExhibitOrRuleRef(t, v))
        .map(toUsd);
    const price_thresholds = uniqueSorted(rawPrice)
        .filter((v) => !isItemOrExhibitOrRuleRef(t, v))
        .map(toUsd);
    const pctF = uniqueSorted(percentages).filter((p) => !isItemOrExhibitOrRuleRef(t, p));
    const shareF = uniqueSorted(share_counts).filter((n) => !isItemOrExhibitOrRuleRef(t, n));
    const dates = [...new Set(dateStrs)]
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
    return {
        percentages: pctF,
        dollar_amounts,
        share_counts: shareF,
        price_thresholds,
        dates,
        time_windows: timeWindowsDedup,
    };
}
//# sourceMappingURL=facts-pipeline.js.map