import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildDocumentRelationships, buildSectionConstraints, extractSections, loadDocument, normalizeParagraphNodesAndGroupBlocks, printClauseTree, segmentSectionsIntoParagraphs, setLogLevel, validateLayer1Tree, validateLayer2Tree, } from './index.js';
import { buildLayer1FilingInput, projectNormalizedClausesFromLayer1, } from './understanding/layer2-from-layer1.js';
import { stringifyLayer2ClausesStable } from './understanding/layer2-clause-order.js';
import { buildBlockRegistry } from './layer1/block-registry.js';
import { normalizeLayer1Graph, validateLayer1Graph, } from './layer1/layer1-graph-compile.js';
import { applyExtractionContractFixes, } from './layer1/extraction-contract-fix.js';
import { validateExtractionContract, } from './layer1/extraction-contract.js';
import { applyEntityIdsToParagraphs, buildEntityRegistry } from './layer1/entity-registry.js';
import { buildDocumentEvents } from './layer1/document-events.js';
import { buildBlockPricingModelMap } from './layer1/pricing-model.js';
function parseArgs(argv) {
    let pdfPath;
    let outText;
    let outJson;
    let understandOut;
    let previewChars = 1200;
    let debug = false;
    let printFlat = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--debug')
            debug = true;
        else if (a === '--flat')
            printFlat = true;
        else if (a.startsWith('--out-text='))
            outText = a.slice('--out-text='.length);
        else if (a.startsWith('--out-json='))
            outJson = a.slice('--out-json='.length);
        else if (a.startsWith('--understand-out='))
            understandOut = a.slice('--understand-out='.length);
        else if (a.startsWith('--preview=')) {
            const n = Number.parseInt(a.slice('--preview='.length), 10);
            previewChars = Number.isFinite(n) ? Math.max(0, n) : 0;
        }
        else if (!a.startsWith('-'))
            pdfPath = a;
    }
    return {
        pdfPath,
        outText,
        outJson,
        understandOut,
        previewChars,
        debug,
        printFlat,
    };
}
function buildPricingMapForSections(sections) {
    const m = new Map();
    for (const s of sections) {
        if (s.type !== 'section')
            continue;
        const paraBy = new Map(s.children
            .filter((x) => x.type === 'paragraph')
            .map((p) => [p.id, p]));
        for (const [bid, pm] of buildBlockPricingModelMap(s.id, s, paraBy)) {
            m.set(bid, pm);
        }
    }
    return m;
}
function clauseTreeForJson(clauses) {
    return clauses.map((c) => {
        const o = {
            id: c.id,
            title: c.title,
            type: c.type,
            text: c.text,
            filingHeader: c.filingHeader,
            pricing: c.pricing,
            atomicKind: c.atomicKind,
            children: clauseTreeForJson(c.children),
        };
        if (c.type === 'paragraph' && c.signals)
            o.signals = c.signals;
        if (c.type === 'paragraph' && c.facts)
            o.facts = c.facts;
        if (c.type === 'section' && c.entities)
            o.entities = c.entities;
        if (c.type === 'section') {
            const ids = (c.blocks ?? []).map((b) => b.id);
            if (ids.length)
                o.block_ids = ids;
            if (c.children.length > 0) {
                o.constraints = buildSectionConstraints(c);
            }
        }
        return o;
    });
}
async function writeOutputFile(path, contents) {
    const dir = dirname(path);
    if (dir && dir !== '.')
        await mkdir(dir, { recursive: true });
    await writeFile(path, contents, 'utf8');
}
async function main() {
    const { pdfPath, outText, outJson, understandOut, previewChars, debug, printFlat, } = parseArgs(process.argv.slice(2));
    if (!pdfPath) {
        console.error(`
Usage:
  npx tsx src/analyze.ts <file.pdf> [options]

Options:
  --out-text=<path>   Write full extracted plain text (whole document)
  --out-json=<path>         Write section tree JSON
  --understand-out=<path>   Write clause understanding JSON array (deterministic)
  --preview=<n>       Console preview length (chars); use 0 to skip (default 1200)
  --flat              Print flat clause list with text length (console)
  --debug             Verbose logging (skipped ids, repeated-line hints)

Relative paths (--out-json=out.json) are created in your current shell directory.
Use an absolute path if you want a fixed location.

Examples:
  npx tsx src/analyze.ts ./contract.pdf --out-text=/tmp/out.txt --out-json=/tmp/out.json
  npx tsx src/analyze.ts ./8-K.pdf --preview=0 --flat
`);
        process.exit(1);
    }
    setLogLevel(debug ? 'debug' : 'info');
    const text = await loadDocument(pdfPath);
    if (outText) {
        const absolute = resolve(outText);
        await writeOutputFile(outText, text);
        console.error(`[analyze] wrote full text (${text.length} chars) → ${absolute}`);
    }
    const sections0 = normalizeParagraphNodesAndGroupBlocks(segmentSectionsIntoParagraphs(extractSections(text)));
    const entity_registry = buildEntityRegistry(sections0);
    const sections = applyEntityIdsToParagraphs(sections0, entity_registry);
    const pricingByBlock = buildPricingMapForSections(sections);
    const block_registry = buildBlockRegistry(sections, pricingByBlock);
    const { events, eventIdByBlock } = buildDocumentEvents(sections, entity_registry);
    let relationships = buildDocumentRelationships(sections, {
        entityRegistry: entity_registry,
        eventIdByBlock,
    }).relationships;
    const graphPayload = {
        entity_registry,
        block_registry,
        events,
        relationships,
    };
    for (let pass = 0; pass < 10; pass++) {
        normalizeLayer1Graph(graphPayload, sections);
        if (validateLayer1Graph(graphPayload, sections).ok) {
            break;
        }
    }
    applyExtractionContractFixes(sections, graphPayload);
    let contractViolations = validateExtractionContract(sections, graphPayload.entity_registry, graphPayload.block_registry, graphPayload.events, graphPayload.relationships);
    for (let round = 0; round < 12 && contractViolations.length > 0; round++) {
        applyExtractionContractFixes(sections, graphPayload);
        contractViolations = validateExtractionContract(sections, graphPayload.entity_registry, graphPayload.block_registry, graphPayload.events, graphPayload.relationships);
    }
    relationships = graphPayload.relationships;
    const eventIdSet = new Set(graphPayload.events.map((e) => e.id));
    const layer1_validation = validateLayer1Tree(sections);
    const layer1_graph_validation = validateLayer1Graph(graphPayload, sections);
    const layer2_validation = validateLayer2Tree(sections, relationships, entity_registry, eventIdSet, graphPayload.block_registry);
    const extraction_contract_ok = contractViolations.length === 0;
    if (outJson) {
        const payload = {
            entity_registry: graphPayload.entity_registry,
            block_registry: graphPayload.block_registry,
            events: graphPayload.events,
            relationships: graphPayload.relationships,
            sections: clauseTreeForJson(sections),
        };
        const absoluteJson = resolve(outJson);
        await writeOutputFile(outJson, JSON.stringify(payload, null, 2));
        console.error(`[analyze] wrote JSON → ${absoluteJson}`);
    }
    if (!layer1_validation.ok) {
        console.error(`[analyze] Layer 1 validation issues (${layer1_validation.issues.length}):`);
        for (const iss of layer1_validation.issues.slice(0, 20)) {
            console.error(`  ${iss.code} ${iss.path}: ${iss.message}`);
        }
        if (layer1_validation.issues.length > 20) {
            console.error(`  … and ${layer1_validation.issues.length - 20} more (fix schema pipeline)`);
        }
    }
    if (!extraction_contract_ok) {
        console.error(`[analyze] Extraction contract FAILED — ${contractViolations.length} rule(s) still violated after auto-fix.`);
        for (const v of contractViolations) {
            console.error(`  [${v.code}] ${v.path}: ${v.message}`);
        }
    }
    if (!layer2_validation.ok) {
        console.error(`[analyze] Layer 2 validation issues (${layer2_validation.issues.length}):`);
        for (const iss of layer2_validation.issues.slice(0, 20)) {
            console.error(`  ${iss.code} ${iss.path}: ${iss.message}`);
        }
    }
    if (!layer1_validation.ok ||
        !layer1_graph_validation.ok ||
        !layer2_validation.ok ||
        !extraction_contract_ok) {
        if (!layer1_graph_validation.ok) {
            console.error(`[analyze] Layer 1 graph invariant issues (${layer1_graph_validation.issues.length}):`);
            for (const iss of layer1_graph_validation.issues.slice(0, 30)) {
                console.error(`  ${iss.code} ${iss.path}: ${iss.message}`);
            }
        }
        process.exit(1);
    }
    if (understandOut) {
        const filing = buildLayer1FilingInput({
            entity_registry,
            block_registry: graphPayload.block_registry,
            events: graphPayload.events,
            relationships,
            sections,
        });
        const intelligence = projectNormalizedClausesFromLayer1(filing);
        const abs = resolve(understandOut);
        await writeOutputFile(understandOut, stringifyLayer2ClausesStable(intelligence));
        console.error(`[analyze] wrote clause understanding (${intelligence.length} rows) → ${abs}`);
    }
    if (previewChars > 0) {
        console.log('\n--- Extracted text preview ---\n');
        console.log(text.slice(0, previewChars));
        if (text.length > previewChars) {
            console.log(`\n… (${text.length - previewChars} more characters)\n`);
        }
    }
    console.log('\n--- Document segments (SEC / outline) ---\n');
    printClauseTree(sections);
    if (printFlat) {
        console.log('\n--- Segment summary ---\n');
        for (const c of sections) {
            console.log(`${c.type}\t${c.id}\ttitle=${JSON.stringify(c.title)}\ttextChars=${c.text.length}`);
        }
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=analyze.js.map