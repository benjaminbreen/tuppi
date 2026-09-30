# tuppi

The [corpus registry](src/data/corpora.json), [corpus overview](src/pages/Corpora.tsx), and [import guide](docs/corpus-imports.md) establish source metadata and separate text, witness, passage, and procedure records for future comparative corpora. Run `npm run audit:corpora` for locally verified counts and explicit unknowns for candidate imports.

An open workbench for Hittite cuneiform texts. First slice: plague, medicine and ritual expertise
(18 compositions, 250 manuscripts, from TLHdig 0.3).

- **Texts** — every manuscript sign by sign, restorations visibly restored, scribal paragraph rulings, cuneiform,
  word-by-word English glosses and an inspector for each word.
- **Substances** — a ledger of materia (plants, minerals, animal products, food & drink) with identification status
  and a keyword-in-context concordance.
- **Browser** — every manuscript as a strip of paragraphs (substances, languages, preservation), plus a
  composition × substance matrix.
- **Rituals** — a searchable catalogue with list and card views, followed by step sequences for Uḫḫamuwa, Allī, Ašḫella, Puliša, Tunnawiya, Dandanku, Paškuwatti and Zarpiya. Each step links to manuscript lines and has a reconstruction image and evidence notes.
  A [task catalogue](src/data/rituals/README.md) indexes individual acts and utterances across rituals, with shared illustrations and source-linked occurrences.
  The [ritual composer](src/pages/RitualComposer.tsx) lets visitors enter a goal, see a connected sequence of up to ten acts, and inspect the source context for each act.
  The [Uḫḫamuwa image briefs](public/rituals/uhhamuwa/IMAGE_BRIEFS.md) record visual choices and their evidence limits.

Catalogue records live in `src/data/rituals/catalog.json`; the [ritual edition guide](src/data/rituals/README.md) describes
the detail schema. The catalogue page loads only the lightweight records; detailed sequences load when opened.

## Run locally

```bash
npm install
npm run dev
```

## Ritual composer: the atomic grammar

The composer at `/rituals/create` now composes from **atoms** rather than whole episodes. Every step in every edition carries `atoms[]`: the step broken into minimal acts, `verb(theme, roles)`, from a closed vocabulary in [`grammar.json`](src/data/rituals/grammar.json) (48 verbs with lifecycle effects, 12 speech acts, 29 object classes, 20 roles). `npm run check:rituals` validates every atom and builds [`atom-index.json`](src/data/rituals/atom-index.json) and [`atom-occurrences.json`](src/data/rituals/atom-occurrences.json); `/ritual-atoms` browses the same act across rituals and traditions.

A request is handled in three parts:

1. **Reading the goal.** Jev answers a fixed question set: which of twelve goal *structures* the request has (sending trouble away on a carrier, stripping and washing, passage, increase by comparison, giving for goodwill, appeasement, protection, transformation, healing, returning harm, seeking a sign, direct petition) and whether it directly asks for a historical aim. The question count no longer grows with the library. In parallel, `gpt-6-luna` normalizes the wording, names the unwanted condition (for dismissals and bindings) and suggests up to three structures. With Jev present Luna only nudges; without Jev its structures set a floor; with neither, a keyword estimate composes and is labelled "offline".
2. **Planning** ([`ritualPlanner.js`](src/lib/ritualPlanner.js)). When Jev matches a historical aim, each ritual is scored by that aim's probability times the share of its steps that serve the aim. A ritual scoring 0.5 or more leads the result in tablet order ("Following Paškuwatti"), adapted with the same safeguards, and relevant rituals also lend their own structures and a strong draw weight to the recombinations offered as alternatives. Recipes are topped up with further plausible structures until they have at least six acts. Each structure is a slot grammar in `grammar.json` (for example *carrier → mark → load → send → dispose*). The planner fills slots with atoms from **any** ritual or tradition, allows several central operations, and ignores source prerequisites. It keeps two hard rules, both derived from verb effects rather than hand-written links: an object must be introduced before it is used (missing ones are pulled from the same passage), and anything that took up the unwanted condition must leave the rite. A later act is re-aimed at the plan's own carrier ("attested for a bull in Puliša; applied here to the ram"). It samples 40 recombinations and keeps the best four; "Another combination" cycles them and then re-plans locally from the same scores with no extra model call.
3. **Cards** ([`ritualGrammarCards.js`](src/lib/ritualGrammarCards.js)). Acts become instructions; each speech act gets composed words (a petition carries the whole wish once; dismissals and bindings name the unwanted condition; comparisons use the image of the object they are about). Every card keeps its source step, quotation and a note on any substitution, and the page marks each seam where one ritual hands over to another.

**Hard safeguards, whatever the model says.** Composed recipes never kill an animal, never select a human substitute, and replace live animals with dough figures (as the dough piglet and clay oxen do within Tunnawiya's own rites). Remedies are shown for their form and never to be eaten or applied. A goal that names a person never reads as returning harm to them; a wish to end anger with them reads as appeasement. `avert-harm` alone is too generic to mark a request as a historical match.

Share links for grammar recipes are payload version 8 and name atoms by `ritual/step#index`; older links still open. The episode engine remains available with `{"engine": "episodes"}` and keeps its own tests. `npm run test:grammar` covers atoms, every structure across many seeds, the safeguards, share links, and the API with Jev and Luna mocked.

### Adding rituals and images

`research/ritual-grammar/` holds the workflow used to add the 11 new editions: an agent brief, a staging validator (`validate-staging.mjs`) and a merge script. New steps use the placeholder `/rituals/_pending.png` with an image prompt on their visual asset; `npm run images:handoff` writes [`docs/RITUAL_IMAGE_PROMPTS.md`](docs/RITUAL_IMAGE_PROMPTS.md) and `docs/ritual-image-pending.json` for GPT-6, with delivery steps.

## Connect Jev to the ritual composer

The composer at `/rituals/create` uses linked source actions and curated source episodes. No embeddings or database are needed. Jev separately judges the plausibility and goal-specific connection of each complete action chain or episode. The planner selects a central operation rather than summing independent plausibility scores, builds preparation, central operation and completion around that core, and shortlists fuller alternatives plus a compact comparison, and asks Jev to assess those complete plans. Five to eight source acts is a soft design target, never a reason to fabricate or split acts. Supporting acts can serve the sequence without independently matching the modern wish. There is no privileged road-god fallback. Creative changes of purpose are allowed; invented historical evidence is not. The planner keeps source prerequisites, object lifecycles, accompanying words, and participant roles together, then assembles compatible groups of up to ten acts. The UI links every suggested step to its original context.

The source links and object lifecycles live in [`composition-actions.json`](src/data/rituals/composition-actions.json); [`composition-episodes.json`](src/data/rituals/composition-episodes.json) retains curated examples. Goal readings live in [`composition-themes.json`](src/data/rituals/composition-themes.json). Modern-use text remains separate from original context.

Every generated or edited recipe has a **Share ritual** link. The versioned URL contains the goal, order, step IDs, and Jev estimates, so opening it needs no account, database, or API call. `/r/:recipe` serves a social preview with a dynamic title and step list, then opens the recipe in the composer. The compact step registry in [`ritual-share-ids.json`](src/data/rituals/ritual-share-ids.json) is append-only: add new IDs at the end so existing links keep pointing to the same steps. There is no server-side store of shared goals.

1. Set `OPENROUTER_API_KEY` and `OPENAI_API_KEY` in the gitignored `.env.local` file in this directory. Restart `npm run dev`. Vite loads these into the local server process; the browser calls `/api/compose` without seeing either key.
2. For Vercel, set the same two names in the project's Environment Variables for each desired deployment environment, then redeploy. The handler reads `process.env` directly; no `.env.local` file is needed in production. Set the Vercel Root Directory to `tuppi` if this folder lives inside a larger repository.

The server calls OpenRouter's Decisions API with model `~typesafe/jev-latest`. A separate TypeSafe account is not required. If `OPENROUTER_API_KEY` is absent, an optional `TYPESAFE_API_KEY` can use TypeSafe's direct API instead. The key is read by `/api/compose` on the server and must **not** have a `VITE_` prefix. Without either key, the page offers an explicitly labelled example preview; it never presents that example as a Jev result. Run `npm run test:composer` to check request construction, ranking, prerequisites, and the endpoint without sending an API request.

### Customized wishes and the OpenAI fallback

Jev still selects the source actions. For modern adaptations, narrow procedural templates normalize simple grade and shop requests without an extra model call. Other phrasing falls back to **`gpt-6-luna` with `reasoning: { effort: "none" }`** through the direct OpenAI Responses API, using `OPENAI_API_KEY`. OpenRouter's key is used for Jev only. This separation is identical locally and on Vercel.

Luna receives only the goal and returns a structured noun phrase and wish sentence. It cannot select actions, change materials, replace divine recipients, or reorder the ritual. Source-specific templates insert those slots into approved tree/cow comparisons. For example, “I want to get an A in world history” becomes “Ask the Sun-god for an A in world history”; a request about Ms Rachel preserves her role as the person making the episode. Adapted spoken words are labeled separately from source quotations. Other source actions retain their existing instructions. Broad or weakly supported matches remain available and are labeled “Exploratory ritual · loose analogy.”

The fallback uses `store: false`, bounded output, and a ten-second timeout. If the key is absent, the request fails, or the response is invalid/refused/incomplete, the valid Jev recipe remains available with its original wording. Luna does **not** replace Jev when Jev is unavailable. Failed wording responses are not cached, so a later request can recover. Successful recipes and wording are cached together for ten minutes. `vercel.json` allows the composer 60 seconds, with a shared 50-second upstream deadline. Whole-plan review has a 15-second cap and runs alongside optional wording. If review fails, the validated local plan is returned with `planning.status: "review-unavailable"` and is not cached.

Version 5 share links include the normalized wish so opening a shared recipe needs neither API key nor another model call; versions 2–4 remain readable.

Run `npm run test:wording` for mocked success, failure, environment-variable and sharing checks. To explicitly exercise the real configured services on the three example goals, run `node --env-file=.env.local scripts/evaluate-ritual-wording.mjs`. That live test sends the goals and curated ritual context to Jev through OpenRouter, and only goals needing normalization to OpenAI. It prints results, never credentials.

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

### Composed speech cards

Modern recipes use `ritualExecution.js` to compile source selections into an executable sequence. Declared speech prerequisites insert an opening before Tunnawiya’s washing or gate crossing, and finish the activity with a threshold comparison or closing petition. These are standalone, numbered text-only cards; physical actions retain their images. Composed wording is explicitly editorial, links to the source action that prompted it, and carries no invented attestation or Jev score. The gate comparison accompanies the crossing rather than adding another crossing.

The compiler uses the saved goal wording (or a literal statement of the goal when normalization is unavailable). Removing a source action rebuilds its dependent speech cards. Version 6 share links save execution version 1 alongside the source selections and wording, so cards regenerate without API calls; versions 2–5 retain their earlier presentation. Run `npm run test:execution` for speech dependencies, completion, edits and sharing checks.

### Expanded operation library and single-pass selection

The composer now has 22 curated source sequences, including earth/dough contact, garment stripping and river disposal, clay modelling, outward-and-returning offerings, an explicit partnership petition, riverbank approach, and a Mesopotamian worn amulet. Existing generated action chains remain available. Original purposes and creative adaptations are recorded separately. Mesopotamian and Hittite blocks are not silently combined in a generated plan.

`composition-vocabulary.json` is an offline evidence index (actors, objects, operations, source loci and excerpt language), rebuilt by `node scripts/build-composition-vocabulary.mjs`. `docs/ritual-image-handoff.json` lists the newly selectable occurrences, current reusable visuals, source anchors and subject briefs for later image work. No new model-generated images are required to use these cards.

The live endpoint now makes one Jev request. It samples among near-best valid plans with different cores; the extra whole-plan review request has been removed. Optional Luna wording remains unchanged. Exact repeated goals reuse cached judgments and wording for ten minutes, sampling locally without another API call; saved recipes preserve the exact chosen steps. This is bounded variety, not a promise that every goal receives different actions. Offline review helper functions remain for evaluation, not production requests. `npm run test:vocabulary` checks every added sequence, source-bound repeated action instances, sharing, tradition boundaries and weighted selection.

### Source-pattern speech (execution version 3)

New modern recipes use eight action-bound speech banks with two procedural variants each: earth cleansing, dough/vitality, fruitful tree, cow/pen, gate passage, closing libation, exclusion/retention, and calling Uliliyašši. `speech-patterns.json` retains full local source paragraphs, their document/paragraph anchors, draft translation status and attribution. These translations are explicitly unreviewed AI drafts; the composed words are adaptations, not quotations or specialist-reviewed reconstructions. Fragmentary dough wording is not silently restored as a translated speech.

Words are selected deterministically from the goal, sequence and source occurrence. Their imagery follows the selected act; only one expanded speech carries the full modern wish, preserving negation and third-party agency. Physical acts retain illustrated cards; pure speech acts become text-only cards with a source link and full draft passage in the details. No automatic opening/closing petitions are added. “Your aim” displays the plain normalized goal separately. Earlier execution versions retain their saved wording.

This adds no API calls: Jev remains single-pass and Luna remains the existing optional goal normalizer. There is no new semantic slot extraction or unrestricted speech generation. Run `npm run test:speech` to verify evidence bindings, variation, attribution, agency and share reproduction.
