import { extractLayer1Signals } from './explicit-signals.js';
/**
 * Always provide three top-level buckets (for JSON superset and validation).
 */
export function expandLayer1SignalBuckets(s) {
    if (!s) {
        return {
            market_signals: {},
            security_signals: {},
            legal_signals: {},
        };
    }
    const m = s.market_signals?.exchange
        ? { exchange: s.market_signals.exchange }
        : {};
    const se = s.security_signals?.security_type
        ? { security_type: s.security_signals.security_type }
        : {};
    const l = s.legal_signals
        ? {
            ...(s.legal_signals.agreement_type != null
                ? { agreement_type: s.legal_signals.agreement_type }
                : {}),
            ...(s.legal_signals.counterparty != null
                ? { counterparty: s.legal_signals.counterparty }
                : {}),
            ...(s.legal_signals.counterparty_raw != null
                ? { counterparty_raw: s.legal_signals.counterparty_raw }
                : {}),
            ...(s.legal_signals.role != null ? { role: s.legal_signals.role } : {}),
            ...(s.legal_signals.counterparty_id != null
                ? { counterparty_id: s.legal_signals.counterparty_id }
                : {}),
        }
        : {};
    return {
        market_signals: m,
        security_signals: se,
        legal_signals: l,
    };
}
export function buildFullSignalsForParagraph(text) {
    return expandLayer1SignalBuckets(extractLayer1Signals(text));
}
//# sourceMappingURL=signal-shape.js.map