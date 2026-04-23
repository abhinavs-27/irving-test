import { createPdfParseLoader } from './pdf-parse-loader.js';
import type { DocumentTextLoader } from './document-loader.js';

let defaultLoader: DocumentTextLoader = createPdfParseLoader();

/**
 * Replace the default PDF backend (tests, future OCR / advanced parsers).
 */
export function setDefaultDocumentLoader(loader: DocumentTextLoader): void {
  defaultLoader = loader;
}

/**
 * Loads and normalizes full document text from a PDF file.
 */
export async function loadDocument(path: string): Promise<string> {
  return defaultLoader.load(path);
}
