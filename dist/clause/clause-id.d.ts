/** Legal-style numbered id after normalization (no spaces). */
export declare const CLAUSE_ID_PATTERN: RegExp;
export declare function normalizeClauseId(raw: string): string;
export declare function isWellFormedClauseId(id: string): boolean;
/** Top-level SEC / pipeline structural ids (not contract numbering). */
export declare function isStructuralClauseId(id: string): boolean;
/**
 * Parent id derived only from numbering structure, e.g. `2.1(a)` → `2.1`, `2.1` → `2`.
 */
export declare function computeParentId(id: string): string | null;
export declare function validateClauseId(id: string, context: string): boolean;
/**
 * Filters obvious false positives from PDF text (street numbers, exhibit codes).
 * Dot or parenthetical segments (e.g. `2.1`, `1(a)`) are always kept.
 */
export declare function isProbableClauseNumbering(id: string): boolean;
//# sourceMappingURL=clause-id.d.ts.map