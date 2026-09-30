import assert from 'node:assert/strict';
import { buildJevRequest, composeFromAnswers } from '../server/ritualComposer.js';
import { EPISODES, episodeStepIds, validateEpisodePlan } from '../src/lib/ritualSemantics.js';
import { encodeRitualRecipe, decodeRitualRecipe } from '../src/lib/ritualShare.js';
import index from '../src/data/rituals/composition-index.json' with { type: 'json' };
import vocabulary from '../src/data/rituals/composition-vocabulary.json' with { type: 'json' };
const ids = ['earth-contact','dough-contact','strip-and-release','river-clay-figures','offer-carry-return','entreat-for-partnership','riverbank-gift-and-appeal','assemble-worn-amulet'];
const request = buildJevRequest('a new undertaking');
for (const id of ids) {
  const episode = EPISODES.find(e => e.id === id);
  assert.ok(episode.operations.length);
  assert.ok(request.questions[`episode_${id}`].instructions.source_acts.every(a => a.source_excerpt));
  const answers = Object.fromEntries(Object.keys(request.questions).map(k => [k, { noul: k === `episode_${id}` || k === `specific_episode_${id}` ? .95 : .02 }]));
  const recipe = composeFromAnswers(answers);
  assert.deepEqual(recipe.items.map(x => x.id), episodeStepIds(episode));
  assert.deepEqual(validateEpisodePlan(recipe.items), []);
  assert.deepEqual(decodeRitualRecipe(encodeRitualRecipe({ ...recipe, goal: 'a new undertaking' })).items.map(x => x.id), episodeStepIds(episode));
}
assert.ok(vocabulary.every(v => v.source.length && v.operations.length));
// Equal strong judgments must permit different valid central operations, without a second call.
const broad = Object.fromEntries(Object.keys(request.questions).map(k => [k, { noul: k.startsWith('aim_') ? .02 : .9 }]));
const cores = new Set();
for (const draw of [0,.25,.5,.75,.99]) {
  const result = composeFromAnswers(broad, null, () => draw);
  cores.add(result.planning.core);
  assert.deepEqual(validateEpisodePlan(result.items), []);
  assert.equal(new Set(result.items.map(x => index.find(y => `${y.ritualId}/${y.stepId}` === x.id).corpusId ?? 'hittite')).size, 1);
}
assert.ok(cores.size > 1);
console.log('Eight expanded source sequences, repeated action bindings, sharing, corpus boundaries and weighted variety passed.');
