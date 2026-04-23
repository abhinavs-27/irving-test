import { createPdfParseLoader } from './pdf-parse-loader.js';
let defaultLoader = createPdfParseLoader();
/**
 * Replace the default PDF backend (tests, future OCR / advanced parsers).
 */
export function setDefaultDocumentLoader(loader) {
    defaultLoader = loader;
}
/**
 * Loads and normalizes full document text from a PDF file.
 */
export async function loadDocument(path) {
    return defaultLoader.load(path);
}
//# sourceMappingURL=load-document.js.map