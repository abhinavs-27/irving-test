import type { Layer1ClauseSignals } from './types.js';
export declare function extractLayer1Signals(text: string): Layer1ClauseSignals;
/** Remove buckets where every leaf is null / empty; omit entirely if nothing left. */
export declare function pruneLayer1Signals(s: Layer1ClauseSignals): Layer1ClauseSignals | undefined;
//# sourceMappingURL=explicit-signals.d.ts.map