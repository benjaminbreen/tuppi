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
   If the step invokes a god, add `deityVisualId` from `deity-visuals.json` and a short `deityLabel` specific to that passage. The plate pairs the material object with the deity relief. For a speech addressed directly to a deity, add the same `deityVisualId` to the canonical unit; the relief then becomes the primary image in the sequence and task catalogue. Record the archaeological model and source link in the deity registry. Puliša's male and female deities, for example, remain unnamed even though their relief types follow Yazılıkaya.
7. Run `npm run check:rituals` and `npm run build`. The checker validates paths, step and phase order, unit and asset references, source documents and anchors, copy-variant references, catalogue counts and PNG alpha channels. It also rejects unused units and assets.

## Deciding whether two acts match

Use the same `unitId` only if the verb and principal object are comparable at the chosen level of detail. Recipient, location, count and particular materials remain on each occurrence and can distinguish variants. For example, Uḫḫamuwa's sheep and Ašḫella's ram share `slaughter-sheep` and its image; Ašḫella also slaughters goats, which the task's match rule explicitly notes. The two rituals' differently coloured wool cords remain separate tasks even though both have the broader `twist-wool` action type. A ram brought forward and one offered later can share an animal cutout while remaining separate tasks.

Before adding a parallel, read both cited passages and record the reason for the match in `units.json`. Never infer a match from identical icons alone. Each attestation remains on its original step; the occurrence index is derived, never hand maintained.

The checker has an explicit exception for KUB 9.31: its file-level catalogue number is CTH 757, while paragraphs 22–25 carry the Uḫḫamuwa selection (CTH 410) and paragraphs 26–34 carry the Ašḫella selection (CTH 394). Review this range if the source extraction changes.

## Tunnawiya's river ritual

CTH 409.I is represented from the long New Hittite copy KUB 7.53+ (local source `kub-7-53-plus`). The 31 steps cover the preparation at the river and spring, cleansing inside the reed shelter, removal and disposal of used materials, and the closing fertility analogies. The [TLHdig tablet](https://smaw.de.dariah.eu/TLHdig/tlh_xtx.php?d=KUB+7.53) and [CTH 409 concordance](https://hethport.net/hetkonk/hetkonk_abfrage.php?c=409) identify the text and joined copy. The English excerpts in `scripts/ritual-excerpts/tunnawiya.json` are exact strings from the site's draft translation and are checked by `build-ritual-quotes.mjs` against that paragraph; they are not a published translation. Several actions in obverse II are restored in the source, recorded in those steps' evidence notes. This edition does not align the other Tunnawiya compositions (CTH 409.II onward) as copies of this river ritual.

## Ašḫella pilot

CTH 394 tests the model with a four-day sequence and a copy-specific passage. The segmentation follows the [Mainz translation](https://hethport.net/txhet_besrit/translatio.php?ed=A.+Chrzanowska&expl=&lg=DE&xst=CTH+394) and its [manuscript introduction](https://hethport.net/txhet_besrit/intro.php?ed=A.+Chrzanowska&lg=DE&prgr=%C2%A7+1&xst=CTH+394), checked against the local English paragraph translations in `translations/kub-9-31.json` and `translations/kbo-13-212-plus.json`. Six main witnesses survive; this pilot links A and B, whose local lines support the selected acts. The washing and passage between fires are explicit in B. A has broken traces of the fire passage, without a clear hand-washing counterpart.

The illustrations isolate the named object where possible. Species, coat colour, vessel form and exact implement placement are reconstructions unless the step note states otherwise. The selected steps are not an exhaustive transcription of every act in the four-day text.

## Puliša pilot

CTH 407 adds twelve atomic acts from [Collins's Mainz edition](https://smaw.de.dariah.eu/txhet_besrit/intro.php?ed=B.-J.+Collins&lg=EN&prgr=&xst=CTH+407), from choosing two human substitutes to driving the bull and ewe ahead of them. The English excerpts are stored in `scripts/ritual-excerpts/pulisa.json` and validated against `translations/kbo-15-1.json`. KBo 15.1 has a second, separate ritual of Ummaya beginning in local paragraph 7; Puliša's steps use only paragraphs 1–5. KBo 21.9 is a short parallel to part of the bull passage, but has not yet been aligned step by step here, so this edition does not assign it step attestations. That is a deliberate source boundary, not an absent-copy claim.
