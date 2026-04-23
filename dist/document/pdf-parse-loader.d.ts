import type { DocumentTextLoader } from './document-loader.js';
export type PdfParseLoaderOptions = {
    /** Override default repeated-line threshold (0–1). */
    repeatedLinePageRatio?: number;
};
/**
 * Loads text from a PDF using `pdf-parse` (per-page extraction, then cleanup).
 */
export declare function createPdfParseLoader(options?: PdfParseLoaderOptions): DocumentTextLoader;
//# sourceMappingURL=pdf-parse-loader.d.ts.map