#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const check = (ok, message) => { if (!ok) throw new Error(`Corpus ritual: ${message}`); };
const catalog = read("public/data/corpora/cmawro.json");
const entries = new Map(catalog.entries.map((entry) => [entry.id, entry]));
const editions = read("src/data/rituals/catalog.json").filter((item) => item.corpusId === "cmawro")
  .map((item) => read(`src/data/rituals/${item.id}.json`));
const materials = read("src/data/corpus-rituals/cmawro-materials.json");
const conditions = read("src/data/corpus-rituals/cmawro-conditions.json");
const comparisons = read("src/data/corpus-rituals/comparisons.json");
const texts = new Map();
function textFor(id) {
  if (!texts.has(id)) texts.set(id, read(`public/data/corpora/cmawro/texts/${id}.json`));
  return texts.get(id);
}
function labels(range) {
  const match = range?.match(/^(.+:)(\d+)([′'′′′]*)?(?:[–-](\d+)([′'′′′]*)?)?$/);
  check(match, `invalid line range ${range}`);
  const first = Number(match[2]);
  const last = Number(match[4] ?? match[2]);
  check(last >= first && last - first < 100, `invalid line span ${range}`);
  const suffix = match[3] ?? "";
  return Array.from({ length: last - first + 1 }, (_, i) => `${match[1]}${first + i}${suffix}`);
}
function checkSource(source) {
  const entry = entries.get(source.sourceId);
  check(source.corpusId === "cmawro" && entry, `unknown source ${source.sourceId}`);
  check(source.sourceUrl === entry.sourceUrl || source.sourceUrl === `https://oracc.museum.upenn.edu/cmawro/${source.sourceId}`, `URL mismatch for ${source.sourceId}`);
  const found = new Set(textFor(source.sourceId).lines.map((line) => line.label));
  for (const label of labels(source.locus)) check(found.has(label), `missing source line ${source.sourceId} ${label}`);
}
const materialIds = new Set(materials.map((item) => item.id));
check(materialIds.size === materials.length, "duplicate material ID");
for (const item of materials) { check(item.id.startsWith("cmawro:"), `unnamespaced material ${item.id}`); checkSource(item.source); }
for (const item of conditions) { check(item.id.startsWith("cmawro:"), `unnamespaced condition ${item.id}`); checkSource(item.source); }
for (const edition of editions) {
  const entry = entries.get(edition.sourceTextId);
  check(entry && edition.corpusId === "cmawro" && edition.cth === null, `unknown or misclassified ${edition.id}`);
  check(edition.steps.length > 0 && edition.steps.every((step, i) => step.number === i + 1), `${edition.id}: invalid step order`);
  check(new Set(edition.steps.map((step) => step.id)).size === edition.steps.length, `${edition.id}: duplicate step ID`);
  check(edition.witnessPeriods.every((period) => entry.witnessPeriods.includes(period)), `${edition.id}: witness period not in catalogue`);
  check(edition.findspots.every((place) => entry.findspots.includes(place)), `${edition.id}: findspot not in catalogue`);
  const byLabel = new Map(textFor(edition.sourceTextId).lines.map((line) => [line.label, line]));
  for (const step of edition.steps) {
    check((step.materialIds ?? []).every((id) => materialIds.has(id)), `${edition.id}/${step.id}: unknown material`);
    check(step.attestations.length > 0, `${edition.id}/${step.id}: missing attestation`);
    for (const attestation of step.attestations) {
      check(attestation.doc === edition.sourceTextId && attestation.anchor.kind === "corpus-line" && attestation.anchor.corpusId === edition.corpusId, `${edition.id}/${step.id}: wrong source`);
      const line = byLabel.get(attestation.anchor.label);
      check(line?.ref === attestation.anchor.ref && attestation.locus === line.label, `${edition.id}/${step.id}: invalid source anchor`);
    }
  }
}
const hittiteMaterials = new Set(read("public/data/substances.json").map((item) => item.id));
const hittiteRituals = new Map(read("src/data/rituals/catalog.json").filter((item) => item.corpusId !== "cmawro").map((item) => [item.id, read(`src/data/rituals/${item.id}.json`)]));
for (const claim of comparisons) {
  check(claim.status === "proposed" && claim.evidence.length, `comparison wrongly asserted: ${claim.id}`);
  checkSource(claim.subject);
  if (claim.object.sourceId.startsWith("s:")) check(hittiteMaterials.has(claim.object.sourceId), `unknown Hittite material ${claim.object.sourceId}`);
  else {
    const [ritualId, stepId] = claim.object.sourceId.split("/");
    check(hittiteRituals.get(ritualId)?.steps.some((step) => step.id === stepId), `unknown Hittite step ${claim.object.sourceId}`);
  }
}
console.log(`Checked ${editions.length} CMAwRo procedures: ${editions.reduce((sum, edition) => sum + edition.steps.length, 0)} anchored actions, ${materials.length} material terms, ${conditions.length} condition records, ${comparisons.length} proposed comparisons.`);
