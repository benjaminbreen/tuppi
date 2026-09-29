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
  The [ritual composer](src/pages/RitualComposer.tsx) lets visitors enter a goal, see up to six suggested acts, and inspect the source context for each act.
  The [Uḫḫamuwa image briefs](public/rituals/uhhamuwa/IMAGE_BRIEFS.md) record visual choices and their evidence limits.

Catalogue records live in `src/data/rituals/catalog.json`; the [ritual edition guide](src/data/rituals/README.md) describes
the detail schema. The catalogue page loads only the lightweight records; detailed sequences load when opened.

## Run locally

```bash
npm install
npm run dev
```

## Connect Jev to the ritual composer

The composer at `/rituals/create` uses the existing ritual task catalogue. No embeddings or database are needed. Each of the 85 attested task occurrences is sent to Jev with its aim, purpose, action, short source excerpt, and a curated symbolic role. Four historical aims and 14 broad goal themes are scored in the same request. The themes let Jev consider modern goals such as interviews, audience growth, rankings, or uncertain windfalls without pretending the Hittite texts described those uses. The server blends the act and theme scores, preserves source order and prerequisites, and favors varied roles for creative recipes. Coercive source steps and animal killing are excluded from modern analogies. A weak connection is labelled a loose analogy. The UI links every suggestion back to its original context. A step's detail panel shows Jev's raw yes/no probability of thematic relevance, and marks prerequisites added by the ordering code; this is not an efficacy score.

The symbolic mapping lives in [`ritual-analogies.json`](src/data/rituals/ritual-analogies.json). A future historical or editorial review can refine each function's role and eligible themes without changing the source edition. Modern-use text remains explicitly separate from original context.

Every generated or edited recipe has a **Share ritual** link. The versioned URL contains the goal, order, step IDs, and Jev estimates, so opening it needs no account, database, or API call. `/r/:recipe` serves a social preview with a dynamic title and step list, then opens the recipe in the composer. The compact step registry in [`ritual-share-ids.json`](src/data/rituals/ritual-share-ids.json) is append-only: add new IDs at the end so existing links keep pointing to the same steps. There is no server-side store of shared goals.

1. Put your existing OpenRouter key after `OPENROUTER_API_KEY=` in the already-created, gitignored `.env.local` file. Restart `npm run dev`.
2. For Vercel, add `OPENROUTER_API_KEY` in the project's Environment Variables for each desired deployment environment, then redeploy. Set the Vercel Root Directory to `tuppi` if this folder lives inside a larger repository.

The server calls OpenRouter's Decisions API with model `~typesafe/jev-latest`. A separate TypeSafe account is not required. If `OPENROUTER_API_KEY` is absent, an optional `TYPESAFE_API_KEY` can use TypeSafe's direct API instead. The key is read by `/api/compose` on the server and must **not** have a `VITE_` prefix. Without either key, the page offers an explicitly labelled example preview; it never presents that example as a Jev result. Run `npm run test:composer` to check request construction, ranking, prerequisites, and the endpoint without sending an API request.

## Deploy (Vercel)

The Vite frontend builds to `dist/`; Vercel serves the Jev proxy from `/api/compose`. The generated data in `public/data/` is committed, so Vercel needs no Python.

- **Option A — its own repo:** push the local `main` branch to a chosen GitHub repository, then import that repository in Vercel (framework preset: Vite).
- **Option B — inside a larger repo:** import that repo in Vercel and set **Root Directory** to `tuppi`.
- **Option C — no git:** `npx vercel` from this folder.

`vercel.json` rewrites frontend routes to `index.html` so deep links like `/text/kub-9-31` work. It routes `/r/:recipe` to the share-preview server function and leaves `/api/compose` to the Jev proxy.

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
