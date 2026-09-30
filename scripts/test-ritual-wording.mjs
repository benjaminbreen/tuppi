import assert from 'node:assert/strict';
import { proceduralGoalFrame, normalizeGoalFrame, goalWordingFor } from '../src/lib/ritualGoal.js';
import { resolveGoalWording, buildWordingRequest } from '../server/ritualWording.js';
import { buildJevRequest } from '../server/ritualComposer.js';
import { instructionFor } from '../src/lib/ritualSemantics.js';
import { encodeRitualRecipe, decodeRitualRecipe } from '../src/lib/ritualShare.js';
import compose from '../api/compose.js';
import share from '../api/share.js';
import aims from '../src/data/rituals/ritual-aims.json' with { type: 'json' };

const grade = 'I want to get an A in world history';
const rachel = 'how do I get Ms Rachel to make a new episode';
const gradeFrame = proceduralGoalFrame(grade);
assert.equal(gradeFrame.outcome, 'an A in world history');
assert.equal(proceduralGoalFrame('I want to open a great ice cream shop').wish, 'May you open a great ice cream shop.');
for (const goal of [rachel, 'I want to get my daughter an A in history', 'I want to get an A in history but not cheat', 'I want to open a shop that my sister runs']) assert.equal(proceduralGoalFrame(goal), null);
assert.equal((await resolveGoalWording(grade, { apiKey: 'fake', fetchImpl: () => { throw new Error('Must not call OpenAI'); } })).wording.status, 'template');
assert.equal((await resolveGoalWording(rachel, { apiKey: '' })).wording.status, 'not-configured');
const normalized = { outcome: 'a new episode from Ms Rachel', wish: 'May Ms Rachel make a new episode.' };
const openaiResponse = (value = normalized) => Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
let calls = 0;
const luna = await resolveGoalWording(rachel, { apiKey: 'test-secret', fetchImpl: async (url, options) => {
  calls++;
  assert.equal(url, 'https://api.openai.com/v1/responses');
  assert.equal(options.headers.Authorization, 'Bearer test-secret');
  const request = JSON.parse(options.body);
  assert.equal(request.model, 'gpt-6-luna');
  assert.deepEqual(request.reasoning, { effort: 'none' });
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(JSON.parse(request.input[0].content).goal, rachel);
  assert.ok(options.signal instanceof AbortSignal);
  return openaiResponse();
} });
assert.equal(calls, 1);
assert.deepEqual(luna.goalFrame, { ...normalized, method: 'luna' });
assert.match(buildWordingRequest(rachel).instructions, /retain other people's names and agency/);
for (const fetchImpl of [
  async () => Response.json({ error: 'private upstream detail' }, { status: 401 }),
  async () => { throw new DOMException('timed out', 'TimeoutError'); },
  async () => Response.json({ status: 'incomplete', output: [] }),
  async () => Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no' }] }] }),
  async () => openaiResponse({ outcome: null, wish: null }),
  async () => openaiResponse({ ...normalized, steps: ['invented'] }),
  async () => openaiResponse({ outcome: '<script>', wish: 'May something happen.' }),
]) {
  const result = await resolveGoalWording(rachel, { apiKey: 'fake', fetchImpl });
  assert.deepEqual(result, { goalFrame: null, wording: { status: 'unavailable' } });
}
assert.throws(() => normalizeGoalFrame({ outcome: 'x', wish: 'May x', method: 'not-a-model' }), /Invalid goal/);

const recipe = { goal: grade, goalFrame: gradeFrame, mode: 'analogy', fit: 'clear', items: ['touch-fruit-tree', 'wish-by-tree'].map((id) => ({ id: `tunnawiya/${id}`, unitId: `tunnawiya-${id}`, reason: 'matched', episodeId: 'tree-increase', matchedTheme: 'increase', jevProbability: .9 })) };
const restored = decodeRitualRecipe(encodeRitualRecipe(recipe));
assert.deepEqual(restored, recipe);
assert.equal(instructionFor(restored.items[1], true, restored.goalFrame), 'Ask the Sun-god for an A in world history');
assert.equal(instructionFor(restored.items[1], false, restored.goalFrame), 'Ask for descendants through the tree analogy');
assert.equal(goalWordingFor(restored.items[0], gradeFrame), null); // Preparation is never rewritten.
assert.match(goalWordingFor(restored.items[1], gradeFrame).words, /As this tree bears fruit, may the ritual patron receive an A/);
assert.match(goalWordingFor(restored.items[1], luna.goalFrame).words, /may Ms Rachel make a new episode/);
const html = await (await share.fetch(new Request(`https://tuppi.test/r/${encodeRitualRecipe(recipe)}`))).text();
assert.match(html, /Ask the Sun-god for an A in world history/);
const payload = JSON.parse(Buffer.from(encodeRitualRecipe(recipe), 'base64url').toString());
payload[0] = 4; payload.length = 5;
assert.equal(decodeRitualRecipe(Buffer.from(JSON.stringify(payload)).toString('base64url')).goalFrame, undefined);
const escaped = { ...recipe, goalFrame: { outcome: '" onload="alert(1)', wish: 'May you succeed.', method: 'luna' } };
const escapedHtml = await (await share.fetch(new Request(`https://tuppi.test/r/${encodeRitualRecipe(escaped)}`))).text();
assert.ok(escapedHtml.includes('&quot; onload=&quot;alert(1)'));
assert.ok(!escapedHtml.includes('for " onload="alert(1)'));

// Vercel-style process.env and the same API handler used by Vite. No real credentials or network.
const names = ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'TYPESAFE_API_KEY'];
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const oldFetch = globalThis.fetch;
let requestNumber = 0, jevCalls = 0, openaiCalls = 0, failWording = false, historical = false;
const post = (goal) => new Request('http://local/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `test-${++requestNumber}` }, body: JSON.stringify({ goal, engine: "episodes" }) });
try {
  process.env.OPENAI_API_KEY = 'wording-test-key';
  process.env.OPENROUTER_API_KEY = 'jev-test-key';
  delete process.env.TYPESAFE_API_KEY;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://api.openai.com/v1/responses') {
      openaiCalls++;
      assert.equal(JSON.parse(options.body).reasoning.effort, 'none');
      return failWording ? Response.json({}, { status: 429 }) : openaiResponse();
    }
    jevCalls++;
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(options.headers.Authorization, 'Bearer jev-test-key');
    const questions = buildJevRequest(rachel).questions;
    const answers = Object.fromEntries(Object.keys(questions).map((id) => [id, { noul: id === 'episode_tree-increase' || id === 'theme_increase' ? .95 : .02 }]));
    if (historical) answers[`aim_${Object.keys(aims).indexOf('seek-descendants')}`].noul = .95;
    return Response.json({ model: 'jev-test', answers });
  };
  let response = await compose.fetch(post(grade));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).wording.status, 'template');
  assert.equal(openaiCalls, 0);
  response = await compose.fetch(post(rachel));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.goalFrame, luna.goalFrame);
  assert.equal(result.model, 'jev-test');
  assert.equal(result.wording.model, 'gpt-6-luna');
  assert.equal(result.items.at(-1).id, 'tunnawiya/wish-by-tree');
  await compose.fetch(post(rachel));
  assert.equal(openaiCalls, 1); // Cache includes normalized wording.
  failWording = true;
  response = await compose.fetch(post('Please ask Ms Rachel to make another episode'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).wording.status, 'unavailable');
  failWording = false;
  response = await compose.fetch(post('Please ask Ms Rachel to make another episode'));
  assert.equal((await response.json()).wording.status, 'luna'); // Failure was not cached.
  delete process.env.OPENAI_API_KEY;
  response = await compose.fetch(post(rachel));
  assert.equal((await response.json()).wording.status, 'not-configured');
  process.env.OPENAI_API_KEY = 'wording-test-key';
  historical = true;
  const before = openaiCalls;
  response = await compose.fetch(post('I want descendants'));
  assert.equal((await response.json()).wording.status, 'not-needed');
  assert.equal(openaiCalls, before);
  assert.equal(jevCalls, 6);
} finally {
  globalThis.fetch = oldFetch;
  for (const name of names) if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
}
console.log('Goal templates, Luna zero-reasoning fallback, API degradation, and personalized share links passed.');
