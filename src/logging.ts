/**
 * Lightweight structured logging for clause PDF pipeline debugging.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function emit(level: LogLevel, msg: string, meta?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const prefix = `[legal-doc:${level}]`;
  if (meta !== undefined) {
    console[level === 'debug' ? 'log' : level](prefix, msg, meta);
  } else {
    console[level === 'debug' ? 'log' : level](prefix, msg);
  }
}

export const legalDocLog = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};
