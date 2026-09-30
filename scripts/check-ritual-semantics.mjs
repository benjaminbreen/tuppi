import assert from 'node:assert/strict';
import { EPISODES, ACTION_CHAINS, ACTIONS, THEMES, episodeStepIds, validateEpisodePlan } from '../src/lib/ritualSemantics.js';
import index from '../src/data/rituals/composition-index.json' with { type: 'json' };
import templates from '../src/data/rituals/action-templates.json' with { type: 'json' };
import bindings from '../src/data/rituals/action-bindings.json' with { type: 'json' };
import quotes from '../src/data/rituals/quotes.json' with { type: 'json' };
const byId = new Map(index.map((item) => [`${item.ritualId}/${item.stepId}`, item]));
assert.equal(new Set(EPISODES.map((item) => item.id)).size, EPISODES.length);
for (const episode of EPISODES) {
  assert.ok(episode.historicalLogic && episode.adaptation && episode.stepIds.length);
  assert.ok(episode.themes.length && episode.themes.every((theme) => THEMES[theme]));
  const items = episodeStepIds(episode).map((id) => ({ id, episodeId: episode.id }));
  if (episode.supports) {
    const support = EPISODES.find((candidate) => candidate.role === episode.supports && candidate.ritualId === episode.ritualId);
    assert.ok(support, `No source-compatible support for ${episode.id}`);
    items.unshift(...episodeStepIds(support).map((id) => ({ id, episodeId: support.id })));
  }
  assert.deepEqual(validateEpisodePlan(items), [], episode.id);
  for (const id of episodeStepIds(episode)) {
    assert.ok(byId.has(id) && quotes[id]?.some((quote) => quote.english || quote.original), `Missing evidence: ${id}`);
    assert.ok(episode.instructions[byId.get(id).stepId], `Missing instruction: ${id}`);
  }
  for (const resource of episode.resources) {
    const position = (id) => episode.stepIds.indexOf(id);
    const start = position(resource.introducedAt), end = position(resource.completedAt);
    assert.ok(start >= 0 && end > start, `Dangling resource: ${episode.id}/${resource.id}`);
    assert.ok(resource.usedAt.length && resource.usedAt.includes(resource.completedAt));
    assert.ok(resource.usedAt.every((id) => position(id) > start && position(id) <= end), `Invalid resource lifecycle: ${resource.id}`);
  }
}
for (const chain of ACTION_CHAINS) {
  assert.ok(chain.role && chain.themes.length && chain.themes.every((theme) => THEMES[theme]));
  assert.ok(chain.stepIds.length > 1, `Incomplete action chain: ${chain.id}`);
  const items = chain.stepIds.map((id) => ({ id, grammarId: chain.id }));
  assert.deepEqual(validateEpisodePlan(items), [], chain.id);
  for (const id of chain.stepIds) {
    assert.ok(byId.has(id) && quotes[id]?.some((quote) => quote.english || quote.original), `Missing evidence: ${id}`);
    assert.ok(ACTIONS[id]?.instruction && ACTIONS[id]?.logic, `Missing action meaning: ${id}`);
    for (const need of ACTIONS[id].needs) assert.ok(chain.stepIds.indexOf(need) < chain.stepIds.indexOf(id), `Reversed action link: ${id}/${need}`);
  }
}
for (const [id, binding] of Object.entries(bindings)) {
  assert.ok(byId.has(id), `Unknown binding occurrence: ${id}`);
  const template = templates[binding.templateId];
  assert.ok(template?.matchRule, `Missing template match rule: ${id}`);
  assert.ok(template.slots.every((slot) => typeof binding[slot] === 'string' && binding[slot]), `Unbound role: ${id}`);
}
console.log(`Validated ${EPISODES.length} attested episodes, ${ACTION_CHAINS.length} generated action chains and ${Object.keys(bindings).length} parameterized action occurrences.`);
