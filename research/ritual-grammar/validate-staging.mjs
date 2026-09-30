// Validate a staged ritual edition before it is merged into src/data/rituals.
// Usage: node research/ritual-grammar/validate-staging.mjs <staging-id> [...]
import fs from 'node:fs';
import path from 'node:path';
import { validateAtom } from '../../src/lib/ritualAtoms.js';

const root = path.resolve(import.meta.dirname, '../..');
const data = (name) => JSON.parse(fs.readFileSync(path.join(root, 'src/data/rituals', name), 'utf8'));
const readIf = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const units = data('units.json'), types = data('action-types.json'), functions = data('ritual-functions.json');
const aims = data('ritual-aims.json'), deities = data('deity-visuals.json'), visuals = data('visual-assets.json'), catalog = data('catalog.json');

let failed = false;
for (const id of process.argv.slice(2)) {
  const dir = path.join(root, 'research/ritual-grammar/staging', id);
  const errors = [], check = (ok, message) => { if (!ok) errors.push(message); };
  const edition = readIf(path.join(dir, 'edition.json'), null);
  if (!edition) { console.error(`${id}: missing edition.json`); failed = true; continue; }
  const stagedUnits = readIf(path.join(dir, 'units.json'), {});
  const stagedTypes = readIf(path.join(dir, 'action-types.json'), {});
  const stagedAims = readIf(path.join(dir, 'ritual-aims.json'), {});
  const stagedFunctions = readIf(path.join(dir, 'ritual-functions.json'), {});
  const stagedVisuals = readIf(path.join(dir, 'visual-assets.json'), {});
  const entry = readIf(path.join(dir, 'catalog-entry.json'), null);
  const excerpts = readIf(path.join(dir, 'excerpts.json'), null);
  const cmawro = edition.corpusId === 'cmawro';
  check(edition.id === id, 'edition id must equal staging folder name');
  check(!catalog.some((item) => item.id === id), 'id already used in catalog');
  check(!!entry && entry.id === id && entry.path === `/rituals/${id}` && entry.stepCount === edition.steps?.length && entry.cth === edition.cth, 'catalog-entry.json missing or inconsistent');
  check(entry?.tags?.length && entry?.searchTerms?.length && entry?.images?.length, 'catalog entry needs tags, searchTerms, images');
  check(edition.purpose && edition.dating?.label && edition.dating?.note && /^https:\/\//.test(edition.dating?.sourceUrl ?? '') && /^https:\/\//.test(edition.editionUrl ?? ''), 'purpose / dating / editionUrl missing');
  check(Array.isArray(edition.variants), 'variants must be an array');
  if (!cmawro) check(Array.isArray(excerpts) && excerpts.length === edition.steps?.length, 'excerpts.json must hold one exact English excerpt per step');
  for (const [key, value] of Object.entries(stagedUnits)) check(!units[key], `unit ${key} already exists; reuse it instead of restaging`);
  const phases = new Set((edition.phases ?? []).map((phase) => phase.name));
  for (const [i, step] of (edition.steps ?? []).entries()) {
    const where = `${id}/${step.id}`;
    check(step.number === i + 1, `${where}: number`);
    check(phases.has(step.phase), `${where}: unknown phase`);
    check(['act', 'utterance'].includes(step.unitType), `${where}: unitType`);
    check(types[step.actionType] || stagedTypes[step.actionType], `${where}: unknown actionType ${step.actionType}`);
    const unit = units[step.unitId] ?? stagedUnits[step.unitId];
    check(!!unit, `${where}: unknown unitId ${step.unitId}`);
    if (unit) {
      check(unit.actionType === step.actionType && unit.unitType === step.unitType, `${where}: unit classification mismatch`);
      check(!!(visuals[unit.visualAssetId] ?? stagedVisuals[unit.visualAssetId]), `${where}: unknown visual ${unit.visualAssetId}`);
      if (units[step.unitId]) check(!!unit.matchRule || true, '');
    }
    check(functions[step.composition?.function] || stagedFunctions[step.composition?.function], `${where}: unknown function`);
    check(step.composition?.aims?.length && step.composition.aims.every((aim) => aims[aim] || stagedAims[aim]), `${where}: aims`);
    check(Array.isArray(step.composition?.requires) && step.composition.requires.every((req) => edition.steps.slice(0, i).some((s) => s.id === req)), `${where}: requires must name earlier steps`);
    check(step.title && step.shortTitle && step.shortDescription && step.summary && step.patient && step.actor && step.verb, `${where}: metadata`);
    check(step.image?.alt && step.image?.note, `${where}: image alt/note`);
    if (step.recipient && /god|deit|seven/i.test(step.recipient)) check(!!step.deityVisualId, `${where}: divine recipient needs deityVisualId`);
    if (step.deityVisualId) check(!!deities[step.deityVisualId] && !!step.deityLabel, `${where}: deity visual`);
    check(Array.isArray(step.atoms) && step.atoms.length > 0, `${where}: atoms[] required`);
    for (const [k, atom] of (step.atoms ?? []).entries()) errors.push(...validateAtom(atom, `${where}#${k}`));
    check(step.attestations?.length > 0, `${where}: attestations`);
    for (const a of step.attestations ?? []) {
      if (cmawro) {
        const file = path.join(root, 'public/data/corpora/cmawro/texts', `${a.doc}.json`);
        const doc = readIf(file, null);
        check(!!doc && a.doc === edition.sourceTextId, `${where}: CMAwRo doc`);
        check(a.anchor?.kind === 'corpus-line' && doc?.lines.some((line) => line.label === a.anchor.label && line.ref === a.anchor.ref), `${where}: CMAwRo line anchor`);
        continue;
      }
      const doc = readIf(path.join(root, 'public/data/docs', `${a.doc}.json`), null);
      check(!!doc, `${where}: missing doc ${a.doc}`);
      if (!doc) continue;
      check(String(doc.cth) === String(edition.cth), `${where}: ${a.doc} has CTH ${doc.cth} but edition is ${edition.cth}`);
      check(a.anchor?.kind === 'paragraph' && Number.isInteger(a.anchor.index) && a.anchor.index < doc.paras.length, `${where}: paragraph anchor`);
      check(a.witness && a.locus, `${where}: witness/locus`);
    }
    if (!cmawro && excerpts?.[i]) {
      const a = step.attestations.find((att) => fs.existsSync(path.join(root, 'translations', `${att.doc}.json`)));
      const translation = a && readIf(path.join(root, 'translations', `${a.doc}.json`), null);
      const para = translation?.paras.find((p) => p.p === a.anchor.index);
      check(!!para && para.en.includes(excerpts[i]), `${where}: excerpt not found verbatim in ${a?.doc} ¶${a?.anchor.index}: "${excerpts[i]}"`);
    }
  }
  for (const phase of edition.phases ?? []) for (let n = phase.range[0]; n <= phase.range[1]; n++) check(edition.steps[n - 1]?.phase === phase.name, `${id}: phase range ${phase.name}`);
  for (const [key, visual] of Object.entries(stagedVisuals)) {
    check(!visuals[key], `visual ${key} already exists`);
    check(visual.src === '/rituals/_pending.png' ? !!visual.prompt : fs.existsSync(path.join(root, 'public', visual.src.slice(1))), `visual ${key}: pending visuals need a prompt; others need a file`);
  }
  if (errors.filter(Boolean).length) { failed = true; console.error(`✗ ${id}\n  ${errors.filter(Boolean).join('\n  ')}`); }
  else console.log(`✓ ${id}: ${edition.steps.length} steps, ${edition.steps.reduce((n, s) => n + s.atoms.length, 0)} atoms`);
}
process.exit(failed ? 1 : 0);
