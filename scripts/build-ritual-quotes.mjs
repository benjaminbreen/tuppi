import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "src/data/rituals");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// Exact excerpts from the site's draft English paragraph translations. The
// script checks each excerpt against the linked paragraph before publishing it.
const excerpts = {
  allii: [
    "a [fig]ure of clay; among them two men(?), and a [kur]ša-bag (of leather)",
    "The person who is bewitched sits down facing the Sun-god",
    "the Old Woman takes the naktamu-vessel together with the clay figure and holds it up towards the Sun-god.",
    "Let him (the sorcerer) take it back for himself",
    "She winds the thread (kapina-) around the figures.",
    "She places kar(a)š-wheat, grain, paššu-breads, a [bow] (and) [three arrows] into a basket and [puts] it be[neath] the bed",
    "he (the patient) sleeps over it.",
    "she takes the basket away from be[neath] the bed and swings it away over the person",
    "She [takes] for herself a clod of earth of the LAM.ḪAL-tree(?), keeps pressing [it] on him",
    "she takes a l[ump](?) of dough, keeps pressing it on him"
  ],
  uhhamuwa: [
    "They drive up two(?) rams",
    "They twist together blue wool, red wool, yellow(-green) wool, black wool and white wool",
    "make [i]t into a crown",
    "they crown one ram",
    "They drive the one ram out onto the road of the enemy",
    "we have driven [this] crowned ram to you, the god, [for pe]ace.",
    "they drive the one crowned ram away [into] the enemy land.",
    "they bring fodder and tallow for the god's horses",
    "let them eat this fodder and be sated. And let your chariot be greased with tallow.",
    "they drive up one billy goat (and) two sheep",
    "He offers the billy goat to the Seven (Sebettu)",
    "one sheep he offers to the Sun-god",
    "one sheep they kill and cook",
    "they kill and cook",
    "Then they bring one cheese, one sour (loaf), one pulla-vessel of sour bread, one bowl of wine, one bowl of beer and fruit",
    "they prepare them for the god of the road."
  ],
  ashella: [
    "each one prepares a ram for himself",
    "I twist together a cord of white wool, red wool (and) green wool",
    "I set into it one [bead(?) and one] ring of iron and of lead, and I bind it onto the necks and horns of the rams.",
    "At night they tie them up in front of the tents",
    "I have tied up these rams; be appeased!",
    "They go and let them loose into the enemy's border(-land)",
    "they slaughter them on the ground",
    "cook them plainly.",
    "they pour salt into water and wash their hands with it.",
    "they kindle fire in two places and walk out between them.",
    "he offers the two billy goats to the Tutelary Deity",
    "they quickly drive up one billy goat, one [r]am and one pig",
    "They offer the billy goat, the ram and the pig to [that] god",
    "He offers the bull to the Storm-god,",
    "he offers the ewe to the Sun-god",
    "they offer the three sheep to all the gods."
  ],
  pulisa: read(path.join(root, "scripts/ritual-excerpts/pulisa.json"))
};

const additionalExcerpts = {
  "ashella/1/B": "each prepares a ram",
  "ashella/2/B": "I twist together a cord of white wool, red wool and green wool",
  "ashella/3/B": "I set into it one bead and one ring of lead, and I bind it on the necks and horns of the rams.",
  "ashella/4/B": "At night they tie them up in front of the tents",
  "ashella/5/B": "be appeased by them!",
  "ashella/6/B": "They go and let them run off into the enemy's border(-land)",
  "ashella/11/B": "he offers the two billy goats to the Tutelary Deity",
  "ashella/12/B": "they quickly drive up one billy goat, one sheep and one pig",
  "ashella/13/B": "they offer the billy goat, the sheep and the pig to that god",
  "ashella/14/B": "They offer the bull to the Storm-god",
  "ashella/15/B": "the ewe to the Sun-god",
  "ashella/16/B": "the three sheep to all the gods."
};

const lineOverrides = { "allii/5/H": 6 };
const docs = new Map();
const translations = new Map();
function getDoc(id) {
  if (!docs.has(id)) docs.set(id, read(path.join(root, "public/data/docs", `${id}.json`)));
  return docs.get(id);
}
function getTranslation(id) {
  if (!translations.has(id)) {
    const file = path.join(root, "translations", `${id}.json`);
    translations.set(id, fs.existsSync(file) ? read(file) : null);
  }
  return translations.get(id);
}
function paragraphIndex(doc, attestation) {
  if (attestation.anchor.kind === "paragraph") return attestation.anchor.index;
  return doc.paras.findIndex(([first, last]) => attestation.anchor.index >= first && attestation.anchor.index <= last);
}
function sourceLineIndex(doc, attestation, key) {
  if (key in lineOverrides) return lineOverrides[key];
  if (attestation.anchor.kind === "line") return attestation.anchor.index;
  const [first, last] = doc.paras[attestation.anchor.index];
  const printed = attestation.locus.match(/(?:obv\.|rev\.)\s+[IVX]+\s+(\d+)/i)?.[1];
  if (!printed) return first;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
    .find((i) => new RegExp(`(?:^|\\D)${printed}(?:\\D|$)`).test(doc.lines[i].n)) ?? first;
}

const catalog = read(path.join(dataDir, "catalog.json"));
const result = {};
for (const entry of catalog) {
  const edition = read(path.join(dataDir, `${entry.id}.json`));
  if (excerpts[entry.id]?.length !== edition.steps.length) throw new Error(`${entry.id}: missing curated English excerpts`);
  for (const step of edition.steps) {
    const preferred = step.attestations.find((a) => getTranslation(a.doc));
    result[`${entry.id}/${step.id}`] = step.attestations.map((attestation) => {
      const doc = getDoc(attestation.doc);
      const key = `${entry.id}/${step.number}/${attestation.witness}`;
      const line = doc.lines[sourceLineIndex(doc, attestation, key)];
      if (!line) throw new Error(`${key}: source line missing`);
      const original = line.w.map((word) => word.r?.map((part) => part[0]).join("") ?? "").filter(Boolean).join(" ");
      if (!original.trim()) throw new Error(`${key}: empty source quotation`);
      const quote = { witness: attestation.witness, locus: attestation.locus, doc: attestation.doc, anchor: attestation.anchor, original };
      const english = attestation === preferred ? excerpts[entry.id][step.number - 1] : additionalExcerpts[key];
      if (english) {
        const translation = getTranslation(attestation.doc);
        const paragraph = translation.paras.find((item) => item.p === paragraphIndex(doc, attestation));
        if (!paragraph?.en.includes(english)) throw new Error(`${key}: English excerpt does not occur in the linked paragraph`);
        quote.english = english;
      }
      return quote;
    });
  }
}
fs.writeFileSync(path.join(dataDir, "quotes.json"), JSON.stringify(result, null, 2) + "\n");
console.log(`Indexed quotations for ${Object.keys(result).length} ritual steps.`);
