import type { DocumentTextLoader } from './document-loader.js';
/**
 * Replace the default PDF backend (tests, future OCR / advanced parsers).
 */
export declare function setDefaultDocumentLoader(loader: DocumentTextLoader): void;
/**
 * Loads and normalizes full document text from a PDF file.
 */
export declare function loadDocument(path: string): Promise<string>;
//# sourceMappingURL=load-document.d.ts.map