import assert from 'node:assert/strict';
import { extractionPacket, reviewExtraction } from './ritual-extraction.mjs';
const packet = extractionPacket('kub-7-53-plus');
assert.ok(packet.source.length && packet.templates['wash-person']);
const draft = {
  doc: 'kub-7-53-plus', steps: [{ id: 'wash', actionType: 'wash-body', unitId: 'tunnawiya-wash-with-water', templateId: 'wash-person',
    matchReason: 'Reflexive washing of a human; water and unspecified body part are occurrence bindings.',
    bindings: { actor: 'beneficiary', target: 'beneficiary', bodyPart: 'unspecified', medium: 'water', accompaniment: 'practitioner incantation' },
    source: [{ paragraph: 16, quote: 'he washes himself with water.' }], requires: [], uncertainty: '',
  }], episodes: [{ id: 'washing', stepIds: ['wash'], historicalLogic: 'Self-washing while the practitioner speaks.', resources: [] }],
};
assert.deepEqual(reviewExtraction(draft).errors, []);
const wrongQuote = structuredClone(draft); wrongQuote.steps[0].source[0].quote = 'he washes a man with milk';
assert.ok(reviewExtraction(wrongQuote).errors.some((error) => error.includes('Quotation')));
const unbound = structuredClone(draft); delete unbound.steps[0].bindings.actor;
assert.ok(reviewExtraction(unbound).errors.some((error) => error.includes('bindings')));
const duplicate = structuredClone(draft); duplicate.steps.push(duplicate.steps[0]);
assert.ok(reviewExtraction(duplicate).errors.some((error) => error.includes('duplicate')));
const dangling = structuredClone(draft); dangling.episodes[0].resources.push({ id: 'ram', introducedAt: 'wash', usedAt: [], completedAt: 'missing' });
assert.ok(reviewExtraction(dangling).errors.some((error) => error.includes('Unresolved resource')));
const novel = structuredClone(draft); novel.steps[0].templateId = null;
assert.ok(reviewExtraction(novel).review.some((item) => item.issue.includes('New template')));
const linked = structuredClone(draft);
linked.episodes = [];
linked.steps.push({ ...structuredClone(linked.steps[0]), id: 'finish', requires: ['wash'] });
linked.actionLinks = [
  { stepId: 'wash', needs: [], opens: ['water'], uses: [], closes: [], terminal: false, instruction: 'Wash', logic: 'Water is applied.' },
  { stepId: 'finish', needs: ['wash'], opens: [], uses: ['water'], closes: ['water'], terminal: true, instruction: 'Finish', logic: 'Water is used.' },
];
assert.deepEqual(reviewExtraction(linked).errors, []);
const unfinished = structuredClone(linked); unfinished.actionLinks[1].closes = [];
assert.ok(reviewExtraction(unfinished).errors.some((error) => error.includes('leaves resources open')));
assert.throws(() => extractionPacket('../../.env.local'), /Invalid document ID/);
console.log('Extraction evidence, reuse review, role bindings and resource checks passed.');
