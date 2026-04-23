/**
 * Deterministic Layer-1 signal extraction (regex/number parse only) for financial / contract text.
 * Complements Layer-2; used for atomic nodes and filing structure.
 */
export type TerminationTriggerCode = 'bankruptcy' | 'insolvency' | 'breach' | 'mature_sun' | 'regulatory' | 'mutual_consent' | 'convenience' | 'insurance' | 'other';
export type TerminationTypeCode = 'automatic' | 'optional' | 'mutual' | 'regulatory' | 'unspecified';
export type Layer1ClauseSignals = {
    pricing?: {
        vwap_formula: string | null;
        discount_percent: number | null;
        valuation_window: string | null;
        exclusions: string[] | null;
    };
    equity?: {
        max_shares: number | null;
        max_dollar_amount: number | null;
        exchange_cap: number | null;
        ownership_cap_percent: number | null;
    };
    termination?: {
        termination_triggers: TerminationTriggerCode[] | null;
        termination_type: TerminationTypeCode;
    };
    payment?: {
        timing: string | null;
        settlement_mechanics: string | null;
        wire_instructions_presence: boolean;
    };
    entities?: {
        ticker_symbols: string[] | null;
        exchanges: string[] | null;
        security_types: string[] | null;
        strike_prices: number[] | null;
        issuer: string | null;
        counterparty: string | null;
        agreement_type_normalized: string | null;
    };
};
/**
 * True when `s` looks like a legal entity / party name, not a mid-clause fragment.
 */
export declare function isValidEntityPhrase(s: string | null | undefined): boolean;
export declare function extractLayer1Signals(text: string): Layer1ClauseSignals;
/** Drop empty buckets so JSON omits meaningless fields. */
export declare function pruneLayer1Signals(s: Layer1ClauseSignals): Layer1ClauseSignals | undefined;
//# sourceMappingURL=clause-signals.d.ts.map