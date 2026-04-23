/**
 * Lightweight structured logging for clause PDF pipeline debugging.
 */
const LEVEL_ORDER = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
let minLevel = 'info';
export function setLogLevel(level) {
    minLevel = level;
}
function emit(level, msg, meta) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel])
        return;
    const prefix = `[legal-doc:${level}]`;
    if (meta !== undefined) {
        console[level === 'debug' ? 'log' : level](prefix, msg, meta);
    }
    else {
        console[level === 'debug' ? 'log' : level](prefix, msg);
    }
}
export const legalDocLog = {
    debug: (msg, meta) => emit('debug', msg, meta),
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
};
//# sourceMappingURL=logging.js.map