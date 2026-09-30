import assert from 'node:assert/strict';
import { buildJevRequest, proposePlans, buildPlanReviewRequest, composeFromAnswers } from '../server/ritualComposer.js';
import handler from '../api/compose.js';
import { validateEpisodePlan } from '../src/lib/ritualSemantics.js';
const goal = 'go to space';
const questions = buildJevRequest(goal).questions;
const fixture = (scores) => Object.fromEntries(Object.keys(questions).map(id => [id, { noul: scores[id] ?? .02 }]));
const answers = fixture({
  'episode_road-provisions': .99, 'specific_episode_road-provisions': .12,
  'episode_gate-passage': .85, 'specific_episode_gate-passage': .9,
  'episode_tree-increase': .8, 'specific_episode_tree-increase': .65,
  'episode_water-cleansing': .75, 'specific_episode_water-cleansing': .3,
  'theme_passage': .95, 'theme_petition': .95,
});
const local = composeFromAnswers(answers);
assert.equal(local.planning.core, 'gate-passage'); // Broad confidence cannot outweigh a specific connection.
assert.ok(!local.items.some(x => x.episodeId === 'road-provisions')); // Generic offerings do not fill the length target.
assert.deepEqual(validateEpisodePlan(local.items), []);
const proposal = proposePlans(answers);
assert.ok(proposal.plans.length > 1 && proposal.plans.length <= 4);
const reviewRequest = buildPlanReviewRequest(goal, proposal);
assert.equal(reviewRequest.state.user_goal, goal);
assert.ok(reviewRequest.state.alternatives.every(x => x.operations.every(y => y.acts.every(z => z.excerpt))));
const alternate = proposal.plans.findIndex(x => x.core === 'tree-increase');
assert.ok(alternate >= 0);
const review = Object.fromEntries(proposal.plans.map((_, i) => [`plan_${i}`, { noul: i === alternate ? .9 : .2 }]));
const reviewed = composeFromAnswers(answers, review);
assert.equal(reviewed.planning.core, 'tree-increase');
assert.equal(reviewed.planning.status, 'reviewed');
assert.deepEqual(validateEpisodePlan(reviewed.items), []);
assert.throws(() => composeFromAnswers(answers, { plan_0: { noul: .9 } }), /Invalid Jev answer/);
assert.throws(() => composeFromAnswers(answers, { ...review, plan_0: { noul: NaN } }), /Invalid Jev answer/);
const low = Object.fromEntries(proposal.plans.map((_, i) => [`plan_${i}`, { noul: .1 }]));
assert.equal(composeFromAnswers(answers, low).fit, 'loose');

// A goal-specific core can grow into a five-act procedure using source-related support.
const arcAnswers = fixture({
  'episode_tree-increase': .9, 'specific_episode_tree-increase': .95,
  'episode_water-cleansing': .5, 'specific_episode_water-cleansing': .1,
  'episode_gate-passage': .55, 'specific_episode_gate-passage': .35,
  'episode_confirm-cleansing': .5, 'specific_episode_confirm-cleansing': .1,
});
const arc = composeFromAnswers(arcAnswers);
assert.equal(arc.planning.core, 'tree-increase');
assert.equal(arc.items.length, 5);
assert.equal(arc.items[0].id, 'tunnawiya/wash-with-water');
assert.equal(arc.items.at(-1).id, 'tunnawiya/libate-sun-god');
assert.deepEqual(validateEpisodePlan(arc.items), []);
assert.equal(arc.planning.form, 'full');
assert.ok(proposePlans(arcAnswers).plans.some(plan => plan.bundle.length === 1));

const saved = { fetch: globalThis.fetch, router: process.env.OPENROUTER_API_KEY, openai: process.env.OPENAI_API_KEY };
try {
  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.OPENAI_API_KEY;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.model, '~typesafe/jev-latest');
    assert.equal(body.state.alternatives, undefined); // One Jev pass, no plan critic call.
    return Response.json({ model: 'test', answers });
  };
  const post = (goal) => handler.fetch(new Request('http://localhost/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal, engine: "episodes" }) }));
  const good = await (await post(goal)).json();
  assert.equal(good.planning.status, 'single-pass');
  assert.deepEqual(validateEpisodePlan(good.items), []);
  await post(goal);
  assert.equal(calls, 1);
} finally {
  globalThis.fetch = saved.fetch;
  for (const [name, value] of [['OPENROUTER_API_KEY', saved.router], ['OPENAI_API_KEY', saved.openai]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
console.log('Specificity, full arcs, optional offline review helpers, single-pass API and cache checks passed.');
