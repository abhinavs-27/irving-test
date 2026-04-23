import { legalDocLog } from '../logging.js';

/** Legal-style numbered id after normalization (no spaces). */
export const CLAUSE_ID_PATTERN =
  /^\d+(?:\.\d+)*(?:\([^)]+\))*$/;

export function normalizeClauseId(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

export function isWellFormedClauseId(id: string): boolean {
  return CLAUSE_ID_PATTERN.test(id);
}

/** Top-level SEC / pipeline structural ids (not contract numbering). */
export function isStructuralClauseId(id: string): boolean {
  return id === 'header' || id === 'signature';
}

/**
 * Parent id derived only from numbering structure, e.g. `2.1(a)` → `2.1`, `2.1` → `2`.
 */
export function computeParentId(id: string): string | null {
  const t = normalizeClauseId(id);
  const parenStrip = /^(.+)\([^)]+\)$/.exec(t);
  if (parenStrip) {
    const base = parenStrip[1];
    return base.length > 0 ? base : null;
  }
  const parts = t.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

export function validateClauseId(id: string, context: string): boolean {
  if (!isWellFormedClauseId(id)) {
    legalDocLog.warn('Malformed or unmatched clause id pattern', {
      context,
      id,
    });
    return false;
  }
  return true;
}

/**
 * Filters obvious false positives from PDF text (street numbers, exhibit codes).
 * Dot or parenthetical segments (e.g. `2.1`, `1(a)`) are always kept.
 */
export function isProbableClauseNumbering(id: string): boolean {
  const t = normalizeClauseId(id);
  if (/[.(]/.test(t)) return true;
  if (/^\d{1,2}$/.test(t)) return true;
  legalDocLog.debug('Skipping bare multi-digit clause candidate', { id: t });
  return false;
}
