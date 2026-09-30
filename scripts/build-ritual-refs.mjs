import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../src/data/rituals");
const catalog = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8"));
const refs = {};
const composition = [];
// Atom layer: every step's atoms[] become individually addressable, comparable acts.
const atoms = [];
const atomOccurrences = {};
const signature = (atom) => atom.verb === "speak" ? `speak:${atom.act}` : `${atom.verb}(${atom.theme?.class ?? ""})`;
for (const entry of catalog) {
  const edition = JSON.parse(fs.readFileSync(path.join(dir, `${entry.id}.json`), "utf8"));
  for (const step of edition.steps) {
    (refs[step.unitId] ??= []).push({ ritualId: edition.id, ritualName: edition.shortName, corpusId: entry.corpusId ?? "tlhdig-hittite", sourceLabel: entry.sourceLabel ?? `CTH ${edition.cth}`, cth: edition.cth, stepId: step.id, stepNumber: step.number, stepTitle: step.title });
    composition.push({
      unitId: step.unitId,
      ritualId: edition.id,
      ritualName: edition.shortName,
      ritualPurpose: edition.purpose,
      cth: edition.cth,
      corpusId: entry.corpusId ?? "tlhdig-hittite",
      sourceLabel: entry.sourceLabel ?? `CTH ${edition.cth}`,
      stepId: step.id,
      stepNumber: step.number,
      stepTitle: step.title,
      summary: step.summary,
      actor: step.actor,
      patient: step.patient,
      phase: step.phase,
      function: step.composition.function,
      aims: step.composition.aims,
      requires: step.composition.requires,
      materials: step.material,
      recipient: step.recipient ?? null,
      source: step.attestations.map(({ witness, doc, locus, anchor }) => ({ witness, doc, locus, anchor }))
    });
    (step.atoms ?? []).forEach((atom, index) => {
      const id = `${edition.id}/${step.id}#${index}`;
      atoms.push({ id, ritualId: edition.id, ritualName: edition.shortName, corpusId: entry.corpusId ?? "tlhdig-hittite",
        sourceLabel: entry.sourceLabel ?? `CTH ${edition.cth}`, region: entry.region ?? null, stepId: step.id, stepNumber: step.number,
        atomIndex: index, unitId: step.unitId, stepTitle: step.title, aims: step.composition.aims, function: step.composition.function,
        recipient: step.recipient ?? null, deityVisualId: step.deityVisualId ?? null, signature: signature(atom), atom });
      (atomOccurrences[signature(atom)] ??= []).push(id);
    });
  }
}
fs.writeFileSync(path.join(dir, "occurrences.json"), JSON.stringify(refs, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "composition-index.json"), JSON.stringify(composition, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "atom-index.json"), JSON.stringify(atoms) + "\n");
fs.writeFileSync(path.join(dir, "atom-occurrences.json"), JSON.stringify(atomOccurrences, null, 1) + "\n");
// Share links name atoms by position in this list. It is append-only: never
// reorder or delete, or existing links will point at the wrong acts.
const shareFile = path.join(dir, "atom-share-ids.json");
const shareIds = fs.existsSync(shareFile) ? JSON.parse(fs.readFileSync(shareFile, "utf8")) : [];
for (const atom of atoms) if (!shareIds.includes(atom.id)) shareIds.push(atom.id);
fs.writeFileSync(shareFile, JSON.stringify(shareIds) + "\n");
console.log(`Indexed ${atoms.length} atoms in ${Object.keys(atomOccurrences).length} signatures.`);
console.log(`Indexed ${Object.values(refs).reduce((sum, items) => sum + items.length, 0)} occurrences of ${Object.keys(refs).length} ritual units.`);
