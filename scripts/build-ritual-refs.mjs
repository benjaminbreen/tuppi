import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../src/data/rituals");
const catalog = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8"));
const refs = {};
for (const entry of catalog) {
  const edition = JSON.parse(fs.readFileSync(path.join(dir, `${entry.id}.json`), "utf8"));
  for (const step of edition.steps) {
    (refs[step.actionType] ??= []).push({ ritualId: edition.id, ritualName: edition.shortName, cth: edition.cth, stepId: step.id, stepNumber: step.number, stepTitle: step.title });
  }
}
fs.writeFileSync(path.join(dir, "occurrences.json"), JSON.stringify(refs, null, 2) + "\n");
console.log(`Indexed ${Object.values(refs).reduce((sum, items) => sum + items.length, 0)} ritual action occurrences.`);
