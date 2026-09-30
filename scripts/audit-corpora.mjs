#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const corpora = read("src/data/corpora.json");
const ids = new Set();
for (const corpus of corpora) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(corpus.id) || ids.has(corpus.id)) throw new Error(`Invalid or duplicate corpus ID: ${corpus.id}`);
  ids.add(corpus.id);
  for (const field of ["name", "culture", "provider", "sourceUrl", "rights", "rightsUrl", "reuseStatus", "stage", "adapter"]) {
    if (!corpus[field]) throw new Error(`${corpus.id} missing ${field}`);
  }
  if (!Array.isArray(corpus.languages) || !corpus.languages.length) throw new Error(`${corpus.id} has no languages`);
  if (!Array.isArray(corpus.genres) || !corpus.genres.length) throw new Error(`${corpus.id} has no genres`);
  if (corpus.dateRange && (corpus.dateRange.start > corpus.dateRange.end || !["corpus", "composition", "witness"].includes(corpus.dateRange.basis))) throw new Error(`${corpus.id} has invalid dates`);
  if (corpus.stage === "imported" && (!corpus.dataPath || !existsSync(join(root, "public", corpus.dataPath)))) throw new Error(`${corpus.id} imported without data`);
}

const index = read("public/data/index.json");
const rituals = read("src/data/rituals/catalog.json");
const local = {
  corpusId: "tlhdig-hittite",
  sourceRecords: index.docs.length,
  compositions: index.compositions.length,
  witnesses: index.docs.length,
  procedures: rituals.filter((ritual) => ritual.corpusId !== "cmawro").length,
  procedureDefinition: "curated ritual sequences in catalog.json; not every ritual in TLHdig",
  translatedWitnesses: Object.keys(read("public/data/tr/index.json")).length,
};
const observations = new Map();
const cmawro = read("src/data/corpus-audits/cmawro-catalogue.json");
if (cmawro.corpusId !== "cmawro" || new Set(cmawro.categories.map((c) => c.id)).size !== cmawro.categories.length) throw new Error("Invalid CMAwRo catalogue observation");
const totalEntries = cmawro.categories.reduce((n, c) => n + c.entries, 0);
const candidateEntries = cmawro.categories.filter((c) => c.proceduralCandidate).reduce((n, c) => n + c.entries, 0);
observations.set("cmawro", { totalEntries, candidateEntries, eligibleProcedures: cmawro.eligibleProcedures, sourceUrl: cmawro.sourceUrl, observedOn: cmawro.observedOn });
const importedCmawro = read("public/data/corpora/cmawro.json");
if (importedCmawro.entries.length !== totalEntries || new Set(importedCmawro.entries.map((e) => e.id)).size !== totalEntries) throw new Error("CMAwRo metadata does not match observed catalogue size or has duplicate IDs");
if (importedCmawro.entries.filter((e) => e.tokenCount > 0).length !== importedCmawro.stats.masterTextsWithTokens) throw new Error("CMAwRo text coverage count mismatch");
for (const entry of importedCmawro.entries) {
  const path = `public/data/corpora/cmawro/texts/${entry.id}.json`;
  if (!existsSync(join(root, path))) throw new Error(`Missing CMAwRo reader file: ${entry.id}`);
  const reading = read(path);
  if (reading.id !== entry.id || reading.lines.reduce((n, line) => n + line.words.length, 0) !== entry.tokenCount) throw new Error(`CMAwRo reader mismatch: ${entry.id}`);
}
const searchRows = read("public/data/corpora/search-lines.json").rows;
const cmawroLines = searchRows.filter((row) => row.corpus === "cmawro");
const hittiteLines = searchRows.filter((row) => row.corpus === "hittite");
const expectedCmawroLines = importedCmawro.entries.reduce((sum, entry) => sum + read(`public/data/corpora/cmawro/texts/${entry.id}.json`).lines.length, 0);
const expectedHittiteLines = index.docs.reduce((sum, doc) => sum + doc.nlines, 0);
if (cmawroLines.length !== expectedCmawroLines || hittiteLines.length !== expectedHittiteLines) throw new Error("Corpus line index coverage mismatch");
const sourceUnits = read("src/data/corpus-audits/cmawro-source-units.json").units;
if (sourceUnits.some((unit) => !importedCmawro.entries.some((entry) => entry.id === unit.textId))) throw new Error("CMAwRo source unit references an unknown text");
console.log("Corpus import audit — source records, witnesses and procedures are separate units\n");
for (const corpus of corpora) {
  if (corpus.id === local.corpusId) {
    console.log(`${corpus.name}: ${local.sourceRecords} source records; ${local.compositions} compositions; ${local.witnesses} witnesses; ${local.procedures} curated ritual procedures; ${local.translatedWitnesses} translated witnesses`);
  } else if (observations.has(corpus.id)) {
    const observation = observations.get(corpus.id);
    console.log(`${corpus.name}: ${observation.totalEntries} master texts; ${importedCmawro.stats.masterTextsWithTokens} with exported transliteration; ${importedCmawro.stats.sourceWitnessEditions} source witness editions; ${observation.candidateEntries} in potentially procedural groups; ${rituals.filter((ritual) => ritual.corpusId === "cmawro").length} curated procedure pilot; corpus-wide eligible procedures UNKNOWN; reuse ${corpus.reuseStatus.toUpperCase()}`);
  } else {
    console.log(`${corpus.name}: source records UNKNOWN; eligible procedures UNKNOWN; translations UNKNOWN; reuse ${corpus.reuseStatus.toUpperCase()}`);
  }
}
console.log("\nImport gate: count distinct, passage-backed procedures with usable text; do not substitute tablet, manuscript, spell or composition counts.");

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), local, candidates: corpora.filter((c) => c.id !== local.corpusId).map((c) => ({ corpusId: c.id, sourceRecords: null, catalogueObservation: observations.get(c.id) ?? null, eligibleProcedures: null, translatedProcedures: null, rightsReviewed: false })) }, null, 2));
}
