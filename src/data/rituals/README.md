# Ritual editions

Each ritual has one JSON file named for its route ID. `catalog.json` supplies the lightweight search and sort fields for the index. An edition loads only when its sequence, step dossier or composition page is opened.

The data distinguishes three things:

| Layer | File | Meaning |
| --- | --- | --- |
| Action category | `action-types.json` | Broad verb family, such as killing an animal. Useful for discovery, insufficient to claim two passages describe the same task. |
| Canonical task | `units.json` | Specific comparable act and object, such as slaughtering sheep. Every ritual step has a `unitId`. The registry states the match rule. |
| Illustration | `visual-assets.json` | One transparent PNG with a stable asset ID. A task refers to an asset; several distinct tasks can share a visual without being merged. |
| Deity image | `deity-visuals.json` | A reusable illustrated relief type with a named archaeological model. Each step that invokes a divine recipient selects one with `deityVisualId`. It does not identify the recipient more precisely than the tablet does. |
| Ritual function | `ritual-functions.json` | Small, defined vocabulary for the role an occurrence plays in its own ritual. `composition.function` records this on the step, not on the shared task. |
| Historical aim | `ritual-aims.json` | What the passage seeks to accomplish. `composition.aims` belongs to each occurrence; the fertility ending of a cleansing ritual can therefore have a different aim from its earlier acts. |

`occurrences.json` is a small index generated from the editions by canonical task ID. The task page at `/ritual-units/{unitId}` shows the image and every annotated occurrence, with a source quotation and links to its step and tablet. Its ritual count is the number of distinct rituals, not the number of copies or repeated steps within one ritual.

`composition-index.json` is generated separately for a future recommendation service. It contains each occurrence's historical aim, function, prerequisites, materials, recipient, phase, ritual purpose and source links. This permits scoring the *occurrence* while the card reuses the canonical task image, without adding the full semantic index to the catalogue's initial download.

## Adding an edition

1. Add a catalogue record with a unique `id`, `/rituals/{id}` path, CTH number, tags, search terms, images and `stepCount`.
2. Add `{id}.json` with title, a one-sentence `purpose` stating what the ritual is for, attribution, `dating`, edition URL, phases, steps and any copy variants. `dating.label` is a short, approximate date for the surviving copies, with a specific `note` and `sourceUrl`; do not imply a precise year of composition from a manuscript date. Number steps in display order from 1.
3. Give each step one prescribed act or utterance, a broad `actionType`, a specific `unitId`, an image alt text and image note, and at least one manuscript attestation. Add the unit to `units.json` with its image asset ID and a concise rule for deciding what matches. Put uncertain details in the local `evidence` or image note, not in a page-wide disclaimer.
   Give the occurrence a `composition.function` from `ritual-functions.json`, one or more source-grounded `composition.aims` from `ritual-aims.json`, and a `composition.requires` array of earlier step IDs when a material or arrangement actually must exist first. An empty prerequisite array is valid. A future goal-based search can rank occurrences using the aim, function, ritual purpose, step text, recipient and source quotation, then sequence candidates under these prerequisites. The same canonical task can have different functions or aims in different rituals. Do not put a modern goal such as “get promoted” in the source record; a future matching service must distinguish its analogy from the ritual's attested purpose.
4. Record each attestation as a witness siglum, local document ID, printed locus and a zero-based line or paragraph anchor. The reader links use the anchor to highlight the passage. A fragment with no surviving passage for an act does not get an attestation.
   `build-ritual-quotes.mjs` takes the Hittite transliteration from that anchor (or the printed line within an anchored paragraph) and checks each curated English excerpt against the linked draft translation. Add an exact excerpt for each new step; never use an editorial step summary as a quotation.
5. Put a disagreement in `variants`: define the units involved, then the order witnessed in each copy. Keep an uncertain placement out of the displayed ordered selection if no shared order can be defended.
6. Copy final transparent PNG assets to `public/rituals/{id}/` and register them in `visual-assets.json`. Reuse an existing image when it depicts the needed object or action. **Sharing an image is not evidence that two acts are the same canonical task.** The unit's `visualAssetId` is the single image reference used by every occurrence of that unit; each step retains its own image note for differences in what the text specifies.
   Review the final image against the step's actor, patient, object and verb. A scene showing the right materials but the wrong act is not a match. Ask image generation for genuine alpha transparency and visible transparent space on all four sides; reject figures or scenery touching the canvas edge. Inspect the output itself before registering it. Depict an uncertain costume simply, without culturally specific dress borrowed from another tradition.
   If the step invokes a god, add `deityVisualId` from `deity-visuals.json` and a short `deityLabel` specific to that passage. The plate pairs the material object with the deity relief. For a speech addressed directly to a deity, add the same `deityVisualId` to the canonical unit; the relief then becomes the primary image in the sequence and task catalogue. Record the archaeological model and source link in the deity registry. Puliša's male and female deities, for example, remain unnamed even though their relief types follow Yazılıkaya.
7. Run `npm run check:rituals` and `npm run build`. The checker validates paths, step and phase order, unit and asset references, source documents and anchors, copy-variant references, catalogue counts and PNG alpha channels. It also rejects unused units and assets.

## Atoms

Every step also carries `atoms[]`, its decomposition into minimal acts from [`grammar.json`](grammar.json). A unit is now a saved group of atoms; the atoms are the comparable layer. Rules:

- One atom per verb. Split conjunctions ("bring a goat and two sheep" is two `bring` atoms) and give an utterance spoken during an act its own `speak` atom.
- `theme` and object-valued roles are entities `{ class, sub, count, f, ref }`: `sub` is a plain noun, colour, material and body part go in `f`, and deities keep their names (`{ "class": "deity", "sub": "Sun-god" }`).
- Classify speech by what it does: petition, appeasement, substitution, dismissal, analogy, declaration, binding, assignment, invocation, confession, vow, accusation. An utterance with several functions gets several atoms.
- Verb effects drive lifecycles: `introduce` (bring, select, collect, build, draw-out), `transform` (combine, shape, crush, cook, kill → `result`), `charge` (hold-over, press: the thing takes up the condition), `consume` (burn, melt, break, bury, release, offer, pour, apply, ingest).
- Record uncertainty in the step's `evidence`, not by inventing an atom for a lost act.

`npm run check:rituals` rejects an unknown verb, speech act, object class or role. `atom-occurrences.json` groups atoms by signature (`verb(class)` or `speak:act`): 63 signatures recur in more than one ritual and 25 cross between Ḫattuša and Mesopotamia, where the old unit layer shared 5 units. A shared signature means the same kind of act, not the same meaning.

## Deciding whether two acts match

Use the same `unitId` only if the verb and principal object are comparable at the chosen level of detail. Recipient, location, count and particular materials remain on each occurrence and can distinguish variants. For example, Uḫḫamuwa's sheep and Ašḫella's ram share `slaughter-sheep` and its image; Ašḫella also slaughters goats, which the task's match rule explicitly notes. The two rituals' differently coloured wool cords remain separate tasks even though both have the broader `twist-wool` action type. A ram brought forward and one offered later can share an animal cutout while remaining separate tasks.

Maddunani and Zelliya add nine source-linked occurrences. Their provisions, bird omen, funeral goods and cremation do not match the principal objects of existing canonical tasks, so they receive distinct unit IDs while reusing the established action vocabulary (`speak-address`, `prepare-material`, and related functions) where appropriate. Maddunani's surviving passage gives no disposition for its two puppies and piglet; it remains a research sequence rather than an automatic composition chain. Zelliya's connected preparation, carrying and cremation are encoded as a historical-only action chain. The damaged intervening passage is stated on the carrying step rather than reconstructed. Generated scenes should depict a violent act when the passage states one, and should not invent slaughter when it only lists an animal.

Tapalazunauli (CTH 424.1) adds a first-day selection from KUB 41.17 + KBo 64.14: the donkey is assigned the evil and driven away, while straw and broken bread are gathered in a basket, taken through the gate and named as food for the god and his dogs. The donkey and basket each have a complete historical-only action chain with their own resource closure. Ummaya (CTH 779) adds four surviving acts from the separate rite on KBo 15.1, after Puliša's section. The object conjured over by the city wall and the intervening incantation are damaged; the edition does not manufacture those acts or promote the sequence into an automatic chain. These passages share broad action types with earlier rituals, but their donkey, basket, man and oxen do not match an existing canonical task's principal object and disposition.

Before adding a parallel, read both cited passages and record the reason for the match in `units.json`. Never infer a match from identical icons alone. Each attestation remains on its original step; the occurrence index is derived, never hand maintained.

The checker has an explicit exception for KUB 9.31: its file-level catalogue number is CTH 757, while paragraphs 22–25 carry the Uḫḫamuwa selection (CTH 410) and paragraphs 26–34 carry the Ašḫella selection (CTH 394). Review this range if the source extraction changes.

## Tunnawiya's river ritual

CTH 409.I is represented from the long New Hittite copy KUB 7.53+ (local source `kub-7-53-plus`). The 31 steps cover the preparation at the river and spring, cleansing inside the reed shelter, removal and disposal of used materials, and the closing fertility analogies. The [TLHdig tablet](https://smaw.de.dariah.eu/TLHdig/tlh_xtx.php?d=KUB+7.53) and [CTH 409 concordance](https://hethport.net/hetkonk/hetkonk_abfrage.php?c=409) identify the text and joined copy. The English excerpts in `scripts/ritual-excerpts/tunnawiya.json` are exact strings from the site's draft translation and are checked by `build-ritual-quotes.mjs` against that paragraph; they are not a published translation. Several actions in obverse II are restored in the source, recorded in those steps' evidence notes. This edition does not align the other Tunnawiya compositions (CTH 409.II onward) as copies of this river ritual.

## Ašḫella pilot

CTH 394 tests the model with a four-day sequence and a copy-specific passage. The segmentation follows the [Mainz translation](https://hethport.net/txhet_besrit/translatio.php?ed=A.+Chrzanowska&expl=&lg=DE&xst=CTH+394) and its [manuscript introduction](https://hethport.net/txhet_besrit/intro.php?ed=A.+Chrzanowska&lg=DE&prgr=%C2%A7+1&xst=CTH+394), checked against the local English paragraph translations in `translations/kub-9-31.json` and `translations/kbo-13-212-plus.json`. Six main witnesses survive; this pilot links A and B, whose local lines support the selected acts. The washing and passage between fires are explicit in B. A has broken traces of the fire passage, without a clear hand-washing counterpart.

The illustrations isolate the named object where possible. Species, coat colour, vessel form and exact implement placement are reconstructions unless the step note states otherwise. The selected steps are not an exhaustive transcription of every act in the four-day text.

## Puliša pilot

CTH 407 adds twelve atomic acts from [Collins's Mainz edition](https://smaw.de.dariah.eu/txhet_besrit/intro.php?ed=B.-J.+Collins&lg=EN&prgr=&xst=CTH+407), from choosing two human substitutes to driving the bull and ewe ahead of them. The English excerpts are stored in `scripts/ritual-excerpts/pulisa.json` and validated against `translations/kbo-15-1.json`. KBo 15.1 has a second, separate ritual of Ummaya beginning in local paragraph 7; Puliša's steps use only paragraphs 1–5. KBo 21.9 is a short parallel to part of the bull passage, but has not yet been aligned step by step here, so this edition does not assign it step attestations. That is a deliberate source boundary, not an absent-copy claim.

## Episode-based composition

Automatic composition uses connected source acts. The fourteen curated episodes in `composition-episodes.json` remain reference examples and reliable fallback sequences. `composition-actions.json` links individual acts through required predecessors and resource lifecycles; the composer derives complete candidate chains from those links. An act enters automatic composition when its linked chain has a terminal action and no open resource. The full source-act library remains available for research and manual editing.

Each episode records source step IDs, source-grounded logic, permitted modern adaptation, participant-aware instructions, an editorial ordering stage, optional support requirements, and resource lifecycles (`introducedAt`, `usedAt`, `completedAt`). Steps remain contiguous and in source order. Shared source order and prerequisite constraints also apply across episodes. A concluding cleansing libation requires a preceding cleansing. An episode is not a claim to reproduce an entire ancient ritual.

`composition-themes.json` describes relational readings of arbitrary goals. Modern nouns are permitted: commerce can involve provision/increase and a request for creative production can involve petition/increase. These mappings are hypotheses about adaptation, not attested Hittite meanings. Never assign a modern celebrity divine identity or invent an ancient god of a modern technology. Do not infer hostile agency from ordinary ambition.

Jev judges each complete candidate’s adaptability and its specific connection to the requested change separately. The bounded planner considers up to four connected blocks and ten source acts, respects prerequisites and resource completion, and chooses a core rather than rewarding extra blocks through summed probabilities. It builds an arc around each core, with a soft target of five to eight source acts, then shortlists up to three distinct cores and a compact alternative for whole-plan Jev review. Cleansing and closure can support the procedure without separately expressing the modern goal; other additions need a specific connection or a source-related transition. The compact alternative lets review reject padding. Generic favor alone should not outrank a particular operation. If no candidate clears the threshold, the best validated candidate remains available as a loose analogy; no named episode is privileged. A “clear” adaptation requires block plausibility, at least one specific connection, and (when available) whole-plan approval. These thresholds are editorial heuristics, not calibrated historical confidence.

Passage through a gate or between fires may creatively express a new destination or phase, despite its original purification setting. Breaking a pot may express a break with an unwanted condition. Preserve the documented act and accompanying participants; distinguish the new interpretation from its historical purpose. Do not invent a construction procedure for the alanza gate: the source occurrence assumes the gate exists. These additions reuse existing occurrences and source links rather than duplicating canonical actions.

The displayed model estimate belongs to the whole episode. It is a probability of the prompted proposition, not a scale of resemblance, a measured calibration on this corpus, or ritual efficacy. Deterministic tests validate planning against synthetic judgments; `scripts/evaluate-ritual-composer.mjs` separately exercises live Jev judgments using configured credentials. Do not confuse those test types.

Version 4 share links encode episode or action-chain identity, theme, order and estimates; version 2 and 3 links still decode. Preserve published episode and terminal action IDs when editing, or introduce a new ID for an incompatible change. Removing an automatically selected act removes its connected group and dependent closure. Adding a linked act adds its complete chain.

## Dandanku and Paškuwatti

Dandanku’s CTH 425.2 selection has eight acts from the Dandanku section of KUB 7.54: the fodder and wool address to Iyarri followed by animal and libation offerings to the Seven. The tablet also contains Maddunani’s separate rite; these steps do not combine the two. Its gathering of fodder reuses Uḫḫamuwa’s canonical fodder task while retaining different accompanying materials in the occurrence. The five road-offering acts form an automatically derived chain, with fodder and wool both completed by the spoken address.

Paškuwatti’s CTH 406 selection has ten acts from KUB 7.8+, including offerings, the reed-gate passage, the exchange of implements, and a petition to Uliliyašši. The gate passage is a linked six-action chain, reserved for direct historical-goal matches because its gendered implements and words have a specific purpose. Its reed gate remains a different canonical task from Tunnawiya’s alanza-wood gate, though both share the broad crossing action type. The source has a longer three-day sequence; this edition selects the first-day passage and a later petition rather than claiming to reproduce every repetition.

Zarpiya’s CTH 757 selection has four acts from the closing passage of KUB 9.31: gathering implements, closing the door, anointing it, and speaking a protective formula. Its action chain keeps the closed and anointed door attached to the words that explain the boundary. KUB 9.31 also contains the Uḫḫamuwa and Ašḫella rites, which remain separate editions.

## Reusable semantic templates and extraction

`action-templates.json` and `action-bindings.json` provide parameterized action identity above existing canonical variants. The first pilot groups three washing occurrences as `wash-person`, retaining body part, medium, actor/target identity and simultaneous speech. Canonical unit IDs, source links and illustration distinctions remain stable; the task pages expose related variants. Future extraction should reuse these templates and units before proposing new ones.

See `scripts/ritual-extraction/README.md` for packet preparation and draft review. The pipeline checks quotations, binding completeness, prerequisites and declared resource completion, then produces a review queue. It does not make unsupervised scholarly determinations or publish unreviewed model output.
