// Merge staged atoms and staged editions into src/data/rituals.
// Usage: node research/ritual-grammar/merge-staging.mjs [--atoms] [edition-id ...]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const dataDir = path.join(root, 'src/data/rituals');
const stage = path.join(root, 'research/ritual-grammar/staging');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readIf = (file, fallback) => fs.existsSync(file) ? read(file) : fallback;
const write = (file, value, compact = false) => fs.writeFileSync(file, JSON.stringify(value, null, compact ? undefined : 2) + '\n');
const args = process.argv.slice(2);

// Insert atoms after composition so the step's source fields stay first.
function withAtoms(step, atoms) {
  const out = {};
  for (const [key, value] of Object.entries(step)) { if (key !== 'atoms') out[key] = value; if (key === 'composition') out.atoms = atoms; }
  if (!out.atoms) out.atoms = atoms;
  return out;
}

if (args.includes('--atoms')) {
  for (const file of fs.readdirSync(path.join(stage, '_atoms'))) {
    const id = file.replace(/\.json$/, '');
    const editionFile = path.join(dataDir, `${id}.json`);
    const atoms = read(path.join(stage, '_atoms', file));
    const edition = read(editionFile);
    edition.steps = edition.steps.map((step) => {
      if (!atoms[step.id]?.length) throw new Error(`${id}/${step.id}: no staged atoms`);
      return withAtoms(step, atoms[step.id]);
    });
    write(editionFile, edition);
    console.log(`atoms → ${id}`);
  }
}

for (const id of args.filter((arg) => !arg.startsWith('--'))) {
  execFileSync('node', [path.join(root, 'research/ritual-grammar/validate-staging.mjs'), id], { stdio: 'inherit' });
  const dir = path.join(stage, id);
  const edition = read(path.join(dir, 'edition.json'));
  edition.steps = edition.steps.map((step) => withAtoms(step, step.atoms));
  write(path.join(dataDir, `${id}.json`), edition);
  const merge = (name, staged) => {
    const target = read(path.join(dataDir, name));
    for (const [key, value] of Object.entries(staged)) { if (target[key] && JSON.stringify(target[key]) !== JSON.stringify(value)) throw new Error(`${name}: ${key} conflicts`); target[key] = value; }
    write(path.join(dataDir, name), target);
  };
  merge('units.json', readIf(path.join(dir, 'units.json'), {}));
  merge('action-types.json', readIf(path.join(dir, 'action-types.json'), {}));
  merge('visual-assets.json', readIf(path.join(dir, 'visual-assets.json'), {}));
  merge('ritual-aims.json', readIf(path.join(dir, 'ritual-aims.json'), {}));
  merge('ritual-functions.json', readIf(path.join(dir, 'ritual-functions.json'), {}));
  const catalog = read(path.join(dataDir, 'catalog.json'));
  const entry = read(path.join(dir, 'catalog-entry.json'));
  const at = catalog.findIndex((item) => item.id === id);
  if (at >= 0) catalog[at] = entry; else catalog.push(entry);
  write(path.join(dataDir, 'catalog.json'), catalog);
  const excerpts = readIf(path.join(dir, 'excerpts.json'), null);
  if (excerpts) write(path.join(root, 'scripts/ritual-excerpts', `${id}.json`), excerpts);
  // Share IDs are append-only: existing positions are permanent link IDs.
  const shareIds = read(path.join(dataDir, 'ritual-share-ids.json'));
  for (const step of edition.steps) if (!shareIds.includes(`${id}/${step.id}`)) shareIds.push(`${id}/${step.id}`);
  write(path.join(dataDir, 'ritual-share-ids.json'), shareIds);
  console.log(`edition → ${id}`);
}
