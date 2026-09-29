import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "src/data/rituals");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const catalog = read("catalog.json");
const types = read("action-types.json");
const units = read("units.json");
const visuals = read("visual-assets.json");
const deities = read("deity-visuals.json");
const quotes = read("quotes.json");
const editions = catalog.map(({ id }) => read(`${id}.json`));
const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };
const unique = (items) => new Set(items).size === items.length;
const docCache = new Map();
const usedUnits = new Set();
const usedVisuals = new Set();
const usedDeities = new Set();

function sourceDoc(id) {
  if (docCache.has(id)) return docCache.get(id);
  const file = path.join(root, "public/data/docs", `${id}.json`);
  const doc = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  docCache.set(id, doc);
  return doc;
}

function image(pathname, context) {
  check(typeof pathname === "string" && pathname.startsWith("/") && !pathname.includes(".."), `${context}: invalid image path`);
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.includes("..")) return;
  const file = path.join(root, "public", pathname.slice(1));
  check(fs.existsSync(file), `${context}: missing image ${pathname}`);
  if (!fs.existsSync(file)) return;
  const bytes = fs.readFileSync(file);
  check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${context}: not a PNG`);
  check(bytes.length > 1000, `${context}: unusually small image`);
  if (bytes.length > 26) check([4, 6].includes(bytes[25]) || bytes.includes(Buffer.from("tRNS")), `${context}: PNG lacks an alpha channel`);
}

check(unique(catalog.map((item) => item.id)), "duplicate catalogue id");
check(unique(catalog.map((item) => item.path)), "duplicate catalogue path");
for (const entry of catalog) {
  const edition = editions.find((item) => item.id === entry.id);
  check(!!edition, `${entry.id}: missing edition`);
  if (!edition) continue;
  check(entry.path === `/rituals/${entry.id}`, `${entry.id}: path differs from route`);
  check(entry.cth === edition.cth, `${entry.id}: CTH mismatch`);
  check(entry.stepCount === edition.steps.length, `${entry.id}: catalogue step count mismatch`);
  check(entry.tags.length > 0 && entry.searchTerms.length > 0, `${entry.id}: catalogue browsing terms missing`);
  entry.images.forEach((item, i) => image(item, `${entry.id} catalogue image ${i + 1}`));
  check(typeof edition.purpose === "string" && edition.purpose.trim().length > 0, `${entry.id}: ritual purpose missing`);
  check(typeof edition.dating?.label === "string" && edition.dating.label.trim().length > 0 && typeof edition.dating?.note === "string" && edition.dating.note.trim().length > 0 && /^https:\/\//.test(edition.dating?.sourceUrl), `${entry.id}: dated manuscript range and source missing`);
  check(/^https:\/\//.test(edition.editionUrl), `${entry.id}: edition URL missing`);
  check(unique(edition.steps.map((step) => step.id)), `${entry.id}: duplicate step id`);
  check(unique(edition.steps.map((step) => step.number)), `${entry.id}: duplicate step number`);
  const phases = new Set(edition.phases.map((phase) => phase.name));
  for (const [i, step] of edition.steps.entries()) {
    const context = `${entry.id}/${step.id}`;
    const stepQuotes = quotes[context];
    check(stepQuotes?.length === step.attestations.length, `${context}: quotations do not match attestations`);
    stepQuotes?.forEach((quote, index) => {
      const attestation = step.attestations[index];
      check(quote.witness === attestation.witness && quote.doc === attestation.doc && quote.anchor.kind === attestation.anchor.kind && quote.anchor.index === attestation.anchor.index, `${context}: quotation source mismatch`);
      check(typeof quote.original === "string" && quote.original.trim().length > 0, `${context}: original quotation missing`);
    });
    check(step.number === i + 1, `${context}: steps must be numbered in order`);
    check(phases.has(step.phase), `${context}: unknown phase`);
    check(["act", "utterance"].includes(step.unitType), `${context}: unknown unit type`);
    check(!!types[step.actionType], `${context}: unknown action type ${step.actionType}`);
    const unit = units[step.unitId];
    check(!!unit, `${context}: unknown canonical unit ${step.unitId}`);
    if (unit) {
      usedUnits.add(step.unitId);
      check(unit.actionType === step.actionType && unit.unitType === step.unitType, `${context}: unit classification mismatch`);
      check(!!unit.title && !!unit.description, `${context}: incomplete canonical unit`);
      const visual = visuals[unit.visualAssetId];
      check(!!visual, `${context}: missing visual asset ${unit.visualAssetId}`);
      if (visual) { usedVisuals.add(unit.visualAssetId); image(visual.src, context); }
      if (unit.deityVisualId) check(step.deityVisualId === unit.deityVisualId, `${context}: address and canonical unit use different deity images`);
    }
    if (step.recipient && /god|deit|seven/i.test(step.recipient)) check(!!step.deityVisualId, `${context}: divine recipient needs an iconographic visual`);
    if (step.deityVisualId) {
      check(typeof step.deityLabel === "string" && step.deityLabel.trim().length > 0, `${context}: deity image needs a step-specific caption`);
      const deity = deities[step.deityVisualId];
      check(!!deity, `${context}: unknown deity visual ${step.deityVisualId}`);
      if (deity) {
        usedDeities.add(step.deityVisualId);
        image(deity.src, `${context} deity visual`);
        check(!!deity.label && !!deity.model && !!deity.note && /^https:\/\//.test(deity.sourceUrl), `${context}: deity visual lacks source metadata`);
      }
    }
    check(step.title && step.shortTitle && step.summary && step.patient && step.actor, `${context}: missing step metadata`);
    check(step.image?.alt && step.image?.note, `${context}: missing image description`);
    check(step.attestations?.length > 0, `${context}: no manuscript attestation`);
    for (const a of step.attestations ?? []) {
      const doc = sourceDoc(a.doc);
      check(!!doc, `${context}: missing source document ${a.doc}`);
      if (!doc) continue;
      const sharedTablet = a.doc === "kub-9-31" && (
        (edition.cth === 410 && a.anchor.kind === "paragraph" && a.anchor.index >= 22 && a.anchor.index <= 25) ||
        (edition.cth === 394 && a.anchor.kind === "paragraph" && a.anchor.index >= 26 && a.anchor.index <= 34)
      );
      check(String(doc.cth) === String(edition.cth) || sharedTablet, `${context}: ${a.doc} has CTH ${doc.cth}`);
      if (edition.id === "pulisa" && a.doc === "kbo-15-1" && a.anchor.kind === "paragraph") check(a.anchor.index >= 1 && a.anchor.index <= 5, `${context}: outside Puliša section of the shared tablet`);
      const collection = a.anchor?.kind === "line" ? doc.lines : a.anchor?.kind === "paragraph" ? doc.paras : null;
      check(!!collection && Number.isInteger(a.anchor.index) && a.anchor.index >= 0 && a.anchor.index < collection.length, `${context}: invalid ${a.doc} anchor`);
      check(!!a.witness && !!a.locus, `${context}: witness or locus missing`);
    }
  }
  for (const phase of edition.phases) {
    const [start, end] = phase.range;
    check(Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end <= edition.steps.length && start <= end, `${entry.id}: invalid phase ${phase.name}`);
    for (let i = start; i <= end; i++) check(edition.steps[i - 1]?.phase === phase.name, `${entry.id}: phase range mismatch at step ${i}`);
  }
  check(edition.phases.reduce((sum, phase) => sum + phase.range[1] - phase.range[0] + 1, 0) === edition.steps.length, `${entry.id}: phase ranges do not cover all steps`);
  for (const variant of edition.variants) {
    const units = new Set(variant.units.map((unit) => unit.id));
    check(unique(variant.units.map((unit) => unit.id)), `${entry.id}/${variant.id}: duplicate variant unit`);
    for (const route of variant.paths) {
      check(route.order.every((id) => units.has(id)), `${entry.id}/${variant.id}: path references unknown unit`);
      check(unique(route.order), `${entry.id}/${variant.id}: repeated unit in path`);
      check(route.sourceLabels?.length === route.sourceDocs.length, `${entry.id}/${variant.id}: source labels do not match documents`);
      route.sourceDocs.forEach((doc) => check(!!sourceDoc(doc), `${entry.id}/${variant.id}: missing source ${doc}`));
    }
  }
}

for (const id of Object.keys(units)) check(usedUnits.has(id), `unused canonical unit ${id}`);
const unitCounts = new Map();
for (const edition of editions) for (const step of edition.steps) unitCounts.set(step.unitId, (unitCounts.get(step.unitId) ?? 0) + 1);
for (const [id, count] of unitCounts) if (count > 1) check(!!units[id].matchRule, `${id}: shared unit needs a specific match rule`);
for (const id of Object.keys(visuals)) check(usedVisuals.has(id), `unused visual asset ${id}`);
for (const id of Object.keys(deities)) check(usedDeities.has(id), `unused deity visual ${id}`);

if (errors.length) { console.error(errors.map((error) => `• ${error}`).join("\n")); process.exit(1); }
console.log(`Checked ${editions.length} ritual editions, ${editions.reduce((sum, edition) => sum + edition.steps.length, 0)} step occurrences, ${usedUnits.size} canonical units, ${usedVisuals.size} action images, ${usedDeities.size} deity images, and ${docCache.size} source documents.`);
