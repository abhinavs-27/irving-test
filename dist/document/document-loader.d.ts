/**
 * Abstraction so PDF extraction can be swapped for OCR, other libraries, etc.
 */
export interface DocumentTextLoader {
    /** Returns normalized plain text for the whole document. */
    load(path: string): Promise<string>;
}
//# sourceMappingURL=document-loader.d.ts.map