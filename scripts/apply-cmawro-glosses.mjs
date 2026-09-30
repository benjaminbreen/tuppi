// Gives unglossed Babylonian plant names in the Ḫattuša texts the English gloss
// that CMAwRo's editors give the same Akkadian lemma. The mapping is curated in
// src/data/substances/cmawro-glosses.json: a syllabic spelling of the lemma, or a
// standard logogram equivalence. A match is kept only if CMAwRo attests the lemma.
// Idempotent: re-running restores and re-applies from the curated list.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const substancesFile = path.join(root, 'public/data/substances.json');
const substances = read('public/data/substances.json');
const mapping = read('src/data/substances/cmawro-glosses.json');

const lexicon = new Map();
for (const file of fs.readdirSync(path.join(root, 'public/data/corpora/cmawro/texts'))) {
  const text = read(`public/data/corpora/cmawro/texts/${file}`);
  for (const line of text.lines) for (const word of line.words) {
    if (!word.lemma || !word.gloss) continue;
    const entry = lexicon.get(word.lemma) ?? { glosses: new Map(), texts: new Set(), n: 0, first: null };
    entry.glosses.set(word.gloss, (entry.glosses.get(word.gloss) ?? 0) + 1);
    entry.texts.add(text.id); entry.n++;
    entry.first ??= { text: text.id, ref: line.ref };
    lexicon.set(word.lemma, entry);
  }
}

let applied = 0;
for (const s of substances) {
  if (s.cmawro) { s.status = s.cmawro.previousStatus; s.label = s.cmawro.previousLabel; delete s.cmawro; }
  const rule = mapping.find((m) => m.lemma === s.lemma);
  if (!rule || s.status !== 'unglossed') continue;
  const entry = lexicon.get(rule.akkadian);
  if (!entry) { console.warn(`not attested in CMAwRo: ${rule.akkadian}`); continue; }
  const top = [...entry.glosses].sort((a, b) => b[1] - a[1])[0][0];
  const gloss = rule.gloss ?? top;
  if (!entry.glosses.has(gloss)) throw new Error(`${rule.akkadian}: CMAwRo does not use the gloss "${gloss}"`);
  s.cmawro = { akkadian: rule.akkadian, gloss, basis: rule.basis, n: entry.n, texts: entry.texts.size, example: entry.first, previousStatus: s.status, previousLabel: s.label };
  s.status = 'cmawro';
  s.label = /^\(/.test(gloss) ? `${rule.akkadian} ${gloss}` : `${gloss.replace(/\?$/, '')}${gloss.endsWith('?') ? ' (?)' : ''}`;
  applied++;
}
fs.writeFileSync(substancesFile, JSON.stringify(substances));
console.log(`Glossed ${applied} Ḫattuša plant names via CMAwRo lemmas.`);
