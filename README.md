# tuppi

An open workbench for Hittite cuneiform texts. First slice: plague, medicine and ritual expertise
(18 compositions, 250 manuscripts, from TLHdig 0.3).

- **Texts** — every manuscript sign by sign, restorations visibly restored, scribal paragraph rulings, cuneiform,
  word-by-word English glosses and an inspector for each word.
- **Substances** — a ledger of materia (plants, minerals, animal products, food & drink) with identification status
  and a keyword-in-context concordance.
- **Browser** — every manuscript as a strip of paragraphs (substances, languages, preservation), plus a
  composition × substance matrix.
- **Rituals** — a searchable catalogue with list and card views, followed by step sequences for Uḫḫamuwa (CTH 410),
  Allī (CTH 402), Ašḫella (CTH 394) and Puliša (CTH 407). Each step links to manuscript lines and has a reconstruction image and evidence notes.
  A [task catalogue](src/data/rituals/README.md) indexes individual acts and utterances across rituals, with shared illustrations and source-linked occurrences.
  The [Uḫḫamuwa image briefs](public/rituals/uhhamuwa/IMAGE_BRIEFS.md) record visual choices and their evidence limits.

Catalogue records live in `src/data/rituals/catalog.json`; the [ritual edition guide](src/data/rituals/README.md) describes
the detail schema. The catalogue page loads only the lightweight records; detailed sequences load when opened.

## Run locally

```bash
npm install
npm run dev
```

## Deploy (Vercel)

The site is fully static: `npm run build` → `dist/`. The generated data in `public/data/` is committed, so Vercel
needs no Python.

- **Option A — its own repo:** push the local `main` branch to a chosen GitHub repository, then import that repository in Vercel (framework preset: Vite).
- **Option B — inside a larger repo:** import that repo in Vercel and set **Root Directory** to `tuppi`.
- **Option C — no git:** `npx vercel` from this folder.

`vercel.json` rewrites all non-file routes to `index.html` so deep links like `/text/kub-9-31` work.

## Rebuild the data

Requires the TLHdig download and research workspace in `../hittite-tlhdig/` (Python with `lxml`).

```bash
python scripts/extract.py     # TLHdig XML -> build/extract.json
python scripts/formdict.py    # corpus-wide written-form -> analysis dictionary
python scripts/build.py       # -> public/data/*.json (+ copies translations/ into public/data/tr/)
python scripts/places.py      # place names in all of TLHdig -> build/places.json (needs ../hittite-tlhdig/data/parsed/docs.jsonl)
node scripts/map.mjs          # project basemap + places -> public/data/map.json
```

(`npm run data` runs all five.)

Curated inputs: `scripts/substances.py` (substance map), `scripts/gloss_en_*.py` (English glosses of TLHdig's German
glosses), composition metadata at the top of `scripts/build.py`, `scripts/gazetteer.py` (locations, with confidence).

## Translations

Draft English translations live in `translations/<doc-slug>.json`, one entry per paragraph of the manuscript (the
scribe's rulings, 0-based as in the worksheet; the site shows them 1-based). To draft or revise one:

```bash
python scripts/worksheet.py kub-9-31 build/ws/kub-9-31.txt   # transliteration + glosses, paragraph by paragraph
```

Every file is marked `"status": "draft"` and names its translator; keep that honest when a specialist reviews one.

## Sources and licences

- Texts and analyses: TLHdig Beta 0.3 (Müller, Prechel, Rieken, Schwemer et al., Zenodo 10.5281/zenodo.20328284), CC BY 4.0.
- Script dates, find-spots, sigla: Konkordanz der hethitischen Keilschrifttafeln (Košak, Müller, Steitler), CC BY-SA 4.0.
- Basemap: Natural Earth (public domain) via the `world-atlas` and `sane-topojson` packages; site coordinates from Wikidata (CC0).
- The derived data in `public/data/` are therefore CC BY-SA 4.0. Code licence: to be chosen.
