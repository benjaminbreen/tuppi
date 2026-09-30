// Explicit live smoke test. Loads credentials through the caller's environment.
// node --env-file=.env.local scripts/evaluate-ritual-wording.mjs
import assert from 'node:assert/strict';
import handler from '../api/compose.js';
import { instructionFor, validateEpisodePlan } from '../src/lib/ritualSemantics.js';
import { encodeRitualRecipe, decodeRitualRecipe } from '../src/lib/ritualShare.js';
const goals = [
  ['I want to get an A in world history', 'template'],
  ['how do I get Ms Rachel to make a new episode', 'luna'],
  ['I want to open a great ice cream shop', 'template'],
];
for (const [goal, expected] of goals) {
  const response = await handler.fetch(new Request('http://localhost/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal }) }));
  const result = await response.json();
  if (!response.ok) throw new Error(`Composition failed: ${result.error} (${response.status})`);
  assert.deepEqual(validateEpisodePlan(result.items), []);
  console.log(JSON.stringify({ goal, model: result.model, mode: result.mode, wording: result.wording, goalFrame: result.goalFrame, instructions: result.items.map((item) => instructionFor(item, result.mode === 'analogy', result.goalFrame)) }, null, 2));
  assert.equal(result.wording.status, expected, `Wording was not exercised as expected for: ${goal}`);
  const restored = decodeRitualRecipe(encodeRitualRecipe(result));
  assert.deepEqual(restored.goalFrame, result.goalFrame);
}
console.log('Live Jev selection, goal wording and share round-trips passed.');
