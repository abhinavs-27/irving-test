/**
 * Lightweight structured logging for clause PDF pipeline debugging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare function setLogLevel(level: LogLevel): void;
export declare const legalDocLog: {
    debug: (msg: string, meta?: unknown) => void;
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
};
//# sourceMappingURL=logging.d.ts.map