import type { Layer1ClauseSignals, LegalCounterpartyRole } from './types.js';
export type FullSignalShape = {
    market_signals: {
        exchange?: string;
    };
    security_signals: {
        security_type?: string;
    };
    legal_signals: {
        agreement_type?: string;
        counterparty?: string;
        counterparty_id?: string;
        counterparty_raw?: string;
        role?: LegalCounterpartyRole;
    };
};
/**
 * Always provide three top-level buckets (for JSON superset and validation).
 */
export declare function expandLayer1SignalBuckets(s: Layer1ClauseSignals | undefined): FullSignalShape;
export declare function buildFullSignalsForParagraph(text: string): FullSignalShape;
//# sourceMappingURL=signal-shape.d.ts.map