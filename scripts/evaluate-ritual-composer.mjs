// Live end-to-end audit; credentials are read from the environment and never logged.
// node --env-file=.env.local scripts/evaluate-ritual-composer.mjs
import assert from 'node:assert/strict';
import handler from '../api/compose.js';
import { validateEpisodePlan, instructionFor } from '../src/lib/ritualSemantics.js';
import { encodeRitualRecipe, decodeRitualRecipe } from '../src/lib/ritualShare.js';
const goals = process.argv.slice(2);
if (!goals.length) goals.push('go to space', 'I want to get an A in world history', 'I want to open a great ice cream shop', 'how do I get Ms Rachel to make a new episode', 'I want to stop biting my nails', 'protect my house from harm');
const counts = {};
for (const goal of goals) {
  const response = await handler.fetch(new Request('http://localhost/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal }) }));
  const recipe = await response.json();
  if (!response.ok) throw new Error(`Composition HTTP ${response.status}: ${recipe.error}`);
  assert.deepEqual(validateEpisodePlan(recipe.items), []);
  assert.deepEqual(decodeRitualRecipe(encodeRitualRecipe(recipe)).items.map(x => x.id), recipe.items.map(x => x.id));
  const operations = [...new Set(recipe.items.map(x => x.episodeId || x.grammarId))];
  for (const id of operations) counts[id] = (counts[id] || 0) + 1;
  console.log(JSON.stringify({ goal, fit: recipe.fit, planning: recipe.planning, operations, instructions: recipe.items.map(x => instructionFor(x, recipe.mode === 'analogy', recipe.goalFrame)) }));
}
// Report concentration for human semantic review; diversity alone is not correctness.
console.log(JSON.stringify({ operationCounts: counts, requests: goals.length }));
