# Ritual editions

Each ritual has one JSON file named for its route ID. `catalog.json` supplies the lightweight search and sort fields for the index. An edition loads only when its sequence, step dossier or composition page is opened. `action-types.json` defines comparison categories; `occurrences.json` is generated from the editions so a step can link to matching units across rituals without loading every edition.

## Adding an edition

1. Add a catalogue record with a unique `id`, `/rituals/{id}` path, CTH number, tags, search terms, images and `stepCount`.
2. Add `{id}.json` with title, a one-sentence `purpose` stating what the ritual is for, attribution, `dating`, edition URL, phases, steps and any copy variants. `dating.label` is a short, approximate date for the surviving copies, with a specific `note` and `sourceUrl`; do not imply a precise year of composition from a manuscript date. Number steps in display order from 1.
3. Give each step one prescribed act or utterance, one `actionType`, an image with alt text and an image note, and at least one manuscript attestation. Put uncertain details in the local `evidence` or image note, not in a page-wide disclaimer.
4. Record each attestation as a witness siglum, local document ID, printed locus and a zero-based line or paragraph anchor. The reader links use the anchor to highlight the passage. A fragment with no surviving passage for an act does not get an attestation.
   `build-ritual-quotes.mjs` takes the Hittite transliteration from that anchor (or the printed line within an anchored paragraph) and checks each curated English excerpt against the linked draft translation. Add an exact excerpt for each new step; never use an editorial step summary as a quotation.
5. Put a disagreement in `variants`: define the units involved, then the order witnessed in each copy. Keep an uncertain placement out of the displayed ordered selection if no shared order can be defended.
6. Copy final transparent PNG assets to `public/rituals/{id}/`. Reuse an existing image only when it depicts the same object or action; explain what it stands for in `image.note`.
7. Run `npm run check:rituals` and `npm run build`. The checker validates paths, step and phase order, action types, source documents and anchors, copy-variant references, catalogue counts and PNG alpha channels.

The checker has an explicit exception for KUB 9.31: its file-level catalogue number is CTH 757, while paragraphs 22–25 carry the Uḫḫamuwa selection (CTH 410) and paragraphs 26–34 carry the Ašḫella selection (CTH 394). Review this range if the source extraction changes.

## Ašḫella pilot

CTH 394 tests the model with a four-day sequence and a copy-specific passage. The segmentation follows the [Mainz translation](https://hethport.net/txhet_besrit/translatio.php?ed=A.+Chrzanowska&expl=&lg=DE&xst=CTH+394) and its [manuscript introduction](https://hethport.net/txhet_besrit/intro.php?ed=A.+Chrzanowska&lg=DE&prgr=%C2%A7+1&xst=CTH+394), checked against the local English paragraph translations in `translations/kub-9-31.json` and `translations/kbo-13-212-plus.json`. Six main witnesses survive; this pilot links A and B, whose local lines support the selected acts. The washing and passage between fires are explicit in B. A has broken traces of the fire passage, without a clear hand-washing counterpart.

The illustrations isolate the named object where possible. Species, coat colour, vessel form and exact implement placement are reconstructions unless the step note states otherwise. The selected steps are not an exhaustive transcription of every act in the four-day text.
