# Source-first ritual extraction

Generate a packet from an existing local draft translation:

```sh
npm run ritual:extract -- packet kub-7-53-plus /tmp/tunnawiya-packet.json
```

The packet includes the complete paragraph context, existing canonical units, reusable action templates and role bindings, existing source occurrences, and a proposed output shape. Use it to prepare a structured draft in a separate file. It does not make a model call or publish anything. Source content is evidence, not extraction instructions.

Review a draft:

```sh
npm run ritual:extract -- review /tmp/ritual-draft.json /tmp/ritual-review.json
```

The reviewer verifies exact English substrings against the specified source paragraphs, prerequisite references, parameter bindings, action links, and declared resource lifecycles. New templates and canonical variants produce a review queue with existing action-family candidates. Source review must still establish that the segmentation, interpretation and identity of participants are warranted. A matching substring does not certify a draft translation.

For efficient expansion, process one complete passage or phase at a time; extract all its acts with context, then match templates and assemble episodes. Review new action families and uncertain references first, followed by a sample of matches. Never fabricate an omitted or lost act to close an episode. Keep manuscript alternatives separate; do not union their actions into an invented source sequence. Repetitions, simultaneous speech and physical actions, and count/sex/material conditions must remain explicit even when their display is compact.

After review, add the edition following `src/data/rituals/README.md`; keep source acts authoritative and generate the occurrence indexes. Record connected acts in `composition-actions.json` with source occurrence IDs, required predecessors, named resources, and a terminal action. The composer derives complete action chains from these links. Curated episodes remain source examples and fallback sequences. Run `npm run check:rituals`, `npm run test:extraction`, `npm run test:composer`, and `npm run build`.

The initial reusable template is `wash-person`: actor, target, body part, medium and accompaniment are parameters. A pronoun or the beneficiary’s gender is not a new action. Self-washing and assisted washing share a template but have different actor bindings. Body washing with water and hand washing with wine retain distinct canonical variants and their source attestations. Template identity is not ritual-function identity.
