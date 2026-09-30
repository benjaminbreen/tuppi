# Brief: mapping a ritual into tuppi's atomic grammar

Project root: `/Users/benbreen/Code/Historical Mysteries/tuppi`. Read `src/data/rituals/README.md` (house rules for editions — follow them), `src/data/rituals/grammar.json` (closed vocabulary) and one existing edition for format, e.g. `src/data/rituals/pulisa.json` and `src/data/rituals/tunnawiya.json`.

**Do not edit anything under `src/`, `public/` or `scripts/`.** Other agents work in parallel. Write only inside your own staging folder `research/ritual-grammar/staging/<id>/`. The lead merges staged work.

## Files to write in `research/ritual-grammar/staging/<id>/`

| File | Content |
| --- | --- |
| `edition.json` | Full edition in the existing format (id, cth, title, shortName, eyebrow, dating{label,note,sourceUrl}, purpose, attribution, sourceSummary, editionUrl, editionLabel, phases[{name,range,idea}], variants: [], steps[]). CMAwRo editions also carry `corpusId: "cmawro"`, `cth: null`, `sourceTextId`. |
| `catalog-entry.json` | One catalogue record: id, path `/rituals/<id>`, title, cth, concern, region, tags, sources, description, images (use `"/rituals/_pending.png"` until art exists), stepCount, searchTerms. CMAwRo: also `corpusId`, `sourceLabel`. |
| `excerpts.json` | Array, one per step in order: an **exact substring** of the linked paragraph's `en` in `translations/<doc>.json` (the paragraph whose `p` equals the attestation's `anchor.index`). Never paraphrase. Not needed for CMAwRo. |
| `units.json` | Only NEW canonical units `{ unitId: { title, description, actionType, unitType, visualAssetId, [deityVisualId], [matchRule] } }`. Reuse an existing unit from `src/data/rituals/units.json` only when verb and principal object genuinely match (then add nothing here, and note the match in the step's `evidence`). |
| `action-types.json` | Only NEW action types `{ id: { title, definition, externalParallels: [] } }`. Prefer existing ones. |
| `visual-assets.json` | NEW visuals, one per new unit: `{ "<id>": { "src": "/rituals/_pending.png", "subject": "...", "medium": "Pending illustration", "status": "pending", "prompt": "<GPT-6 image prompt>" } }`. Reusing an existing visual asset ID is allowed only if the existing image truly depicts this act/object. |
| `ritual-aims.json`, `ritual-functions.json` | Only if you need NEW aims/functions (`{ id: "one-sentence definition" }`). Prefer existing ones. |

### Image prompt style (for `prompt`)
"Transparent-background PNG, flat illustrative style matching a museum-plate reconstruction: [actor], [verb], [object with specified features]. Plain simple dress without culturally specific costume from another tradition; no scenery; figures and objects must not touch the canvas edge; visible transparent margin on all four sides; no text." Depict only what the passage states: violence only if stated; no invented objects.

## Step rules (from README, summarised)
- Each step = one prescribed act or utterance, in source order, numbered from 1. Select the acts that are clearly legible; skip lost/broken passages rather than reconstructing them, and say so in `evidence`.
- Required step fields: id, number, title, shortTitle, shortDescription, phase, unitType (`act`|`utterance`), actionType, verb, summary, patient, actor, material[], evidence, image{alt,note}, attestations[{witness, doc, locus, anchor{kind:"paragraph", index}}] (CMAwRo: anchor `{kind:"corpus-line", ref, label}`), unitId, composition{function, requires[], aims[]}, **atoms[]**. Optional: recipient, deityVisualId + deityLabel (required if recipient is a god; use only ids in `src/data/rituals/deity-visuals.json`: unnamed-god, unnamed-goddess, storm-god, sun-god, the-seven, divine-assembly), place.
- The attestation `doc` must be a file in `public/data/docs/` whose `cth` equals the edition's `cth`; `anchor.index` is the paragraph index (same as `p` in the translation).
- `composition.aims` must be historical aims of the source, not modern goals.

## Atoms (the important new part)
Each step gets `atoms[]`: the step decomposed into minimal acts `verb(theme, roles)` from `grammar.json`.
- `verb` ∈ grammar `verbs`. Speech: `{ "verb": "speak", "act": <speechActs key>, "addressee": {...}, "about": {...} }`.
- `theme` and object-valued roles are entities: `{ "class": <objectClasses key>, "sub": "ram", "count": 2, "f": { "color": "black", "colors": [...], "material": "clay", "part": "horns", "adorned": true }, "ref": "optional-stable-id" }`. Keep `sub` a plain lowercase noun (`ram`, `bread`, `gate`, `hands`); put colours/material/body part in `f`. Proper names (deities) keep capitals: `{ "class": "deity", "sub": "Sun-god" }`.
- Participants: `{ "class": "person", "sub": "patient" | "practitioner" | "offerant" | "king" | "participants" | ... }`.
- Other roles (only from grammar `roles`): agent, recipient, goal, source, location, boundary, instrument, medium, onto, from, over, on, to, for, with, result, time, manner, addressee, about. Values are entity objects or short strings ("enemy land", "riverbank", "at night").
- Split conjunctions: "bring a goat and two sheep" = two `bring` atoms. "twist wool and make a wreath" = `combine` + `shape`. An incantation spoken during an act = the act atom + a `speak` atom.
- Classify speech carefully by what it does: petition (asks for a good), appeasement (asks anger to cease), substitution ("this is your substitute"), dismissal ("go!", "take it back"), analogy ("as X…, so may Y…"), declaration ("I have cleansed…"), binding ("let it be seized"), assignment ("this is for you"), invocation, confession, vow. One utterance may contain several acts → several atoms.
- Use `ref` when the same object recurs and `class:sub` would be ambiguous (e.g. two different figures).
- `hold-over` = the carrier takes up the harm. `release`/`burn`/`bury`/`break`/`melt` end an object's life. `kill` transforms an animal into meat (`result: {class:"meat"}`).

Example:
```json
"atoms": [
  { "verb": "attach", "theme": { "class": "ornament", "sub": "wreath", "f": { "material": "wool", "colors": ["blue","red"] } }, "onto": { "class": "animal", "sub": "ram", "f": { "part": "head" } } },
  { "verb": "speak", "act": "substitution", "addressee": { "class": "deity", "sub": "male deity" }, "about": { "class": "animal", "sub": "ram" } }
]
```

## Validate
Run `node research/ritual-grammar/validate-staging.mjs <id>` from the project root until it prints ✓. Then finish with a short report: id, number of steps, anything uncertain, and any match to an existing unit you made.
