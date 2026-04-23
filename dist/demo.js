import { buildHierarchy, extractClauses, loadDocument, printClauseTree, setLogLevel, } from './index.js';
async function main() {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
        console.error('Usage: npm run demo -- <path-to.pdf>');
        process.exit(1);
    }
    setLogLevel('info');
    const text = await loadDocument(pdfPath);
    console.log('\n--- Extracted text preview (first 1200 chars) ---\n');
    console.log(text.slice(0, 1200));
    console.log('\n--- Clause outline ---\n');
    const flat = extractClauses(text);
    const tree = buildHierarchy(flat);
    printClauseTree(tree);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=demo.js.map