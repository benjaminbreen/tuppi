import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../src/data/rituals");
const catalog = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8"));
const refs = {};
const composition = [];
for (const entry of catalog) {
  const edition = JSON.parse(fs.readFileSync(path.join(dir, `${entry.id}.json`), "utf8"));
  for (const step of edition.steps) {
    (refs[step.unitId] ??= []).push({ ritualId: edition.id, ritualName: edition.shortName, cth: edition.cth, stepId: step.id, stepNumber: step.number, stepTitle: step.title });
    composition.push({
      unitId: step.unitId,
      ritualId: edition.id,
      ritualName: edition.shortName,
      ritualPurpose: edition.purpose,
      cth: edition.cth,
      stepId: step.id,
      stepNumber: step.number,
      stepTitle: step.title,
      summary: step.summary,
      phase: step.phase,
      function: step.composition.function,
      aims: step.composition.aims,
      requires: step.composition.requires,
      materials: step.material,
      recipient: step.recipient ?? null,
      source: step.attestations.map(({ witness, doc, locus, anchor }) => ({ witness, doc, locus, anchor }))
    });
  }
}
fs.writeFileSync(path.join(dir, "occurrences.json"), JSON.stringify(refs, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "composition-index.json"), JSON.stringify(composition, null, 2) + "\n");
console.log(`Indexed ${Object.values(refs).reduce((sum, items) => sum + items.length, 0)} occurrences of ${Object.keys(refs).length} ritual units.`);
