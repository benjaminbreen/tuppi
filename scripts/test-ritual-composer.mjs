import assert from "node:assert/strict";
import { buildJevRequest, composeFromAnswers, proposePlans, buildPlanReviewRequest } from "../server/ritualComposer.js";
import handler from "../api/compose.js";
import shareHandler from "../api/share.js";
import { decodeRitualRecipe, encodeRitualRecipe } from "../src/lib/ritualShare.js";
import { EPISODES, ACTION_CHAINS, THEMES, validateEpisodePlan, instructionFor } from "../src/lib/ritualSemantics.js";
import aims from "../src/data/rituals/ritual-aims.json" with { type: "json" };
import shareIds from "../src/data/rituals/ritual-share-ids.json" with { type: "json" };

const request = buildJevRequest("open a great ice cream shop");
assert.equal(Object.keys(request.questions).length, Object.keys(aims).length + Object.keys(THEMES).length + 2 * (EPISODES.length + ACTION_CHAINS.length));
assert.ok(request.questions['episode_tree-increase'].instructions.source_acts.every((act) => act.source_excerpt));
assert.match(request.questions['episode_tree-increase'].instructions.question, /modern circumstances/);
const fixture = (scores = {}) => Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: 'noul', noul: scores[id] ?? (id.startsWith('specific_') ? scores[id.slice(9)] : undefined) ?? 0.03 }]));
const ids = (result) => result.items.map((item) => item.id);
const episodeIds = (result) => [...new Set(result.items.map((item) => item.episodeId))];
const check = (result) => assert.deepEqual(validateEpisodePlan(result.items), []);

// Unfamiliar goals still get a complete, explicitly broad reconstruction.
const fallback = composeFromAnswers(fixture());
check(fallback);
assert.equal(fallback.fit, 'loose');
assert.notDeepEqual(episodeIds(fallback), ['road-provisions']);
assert.throws(() => composeFromAnswers({}), /Invalid Jev answer/);

// These deterministic fixtures exercise planning, not Jev's semantic accuracy.
for (const goal of ['I want to open a great ice cream shop', 'how do I get ms rachel to make a new episode', 'I want to do good at school']) {
  const recipe = composeFromAnswers(fixture({ 'theme_increase': .95, 'theme_petition': .9, 'theme_provision': .8, 'episode_road-provisions': .85, 'episode_tree-increase': .91 }));
  check(recipe);
  assert.deepEqual(episodeIds(recipe), ['road-provisions', 'tree-increase'], goal);
  assert.ok(!ids(recipe).includes('ashella/prepare-ram'));
  assert.ok(ids(recipe).includes('tunnawiya/wish-by-tree'));
}
const ram = composeFromAnswers(fixture({ 'episode_ram-release': .99, 'theme_release': .97 }));
check(ram);
assert.equal(ram.items.length, 6);
assert.equal(ids(ram).at(-1), 'ashella/release-rams');
assert.ok(validateEpisodePlan(ram.items.slice(0, -1)).length);
assert.ok(validateEpisodePlan([...ram.items].reverse()).length);
assert.ok(validateEpisodePlan([ram.items[0]]).length);
const closureOnly = composeFromAnswers(fixture({ 'episode_confirm-cleansing': .99 }));
assert.ok(!episodeIds(closureOnly).includes('confirm-cleansing'));
const cleanse = { mode: 'analogy', fit: 'clear', items: ['water-cleansing', 'tree-increase', 'confirm-cleansing'].flatMap((id) => {
  const episode = EPISODES.find((e) => e.id === id);
  return episode.stepIds.map((step) => ({ id: `${episode.ritualId}/${step}`, unitId: `${episode.ritualId}-${step}`, episodeId: id, reason: 'matched', matchedTheme: episode.themes[0], jevProbability: .9 }));
}) };
check(cleanse);
assert.equal(ids(cleanse)[0], 'tunnawiya/wash-with-water');
assert.equal(ids(cleanse).at(-1), 'tunnawiya/libate-sun-god');
assert.match(instructionFor(cleanse.items[0]), /^Wash yourself/);
assert.ok(validateEpisodePlan(cleanse.items.filter((item) => item.episodeId !== 'water-cleansing')).length);
const mixed = composeFromAnswers(fixture({ 'episode_road-provisions': .95, 'specific_episode_road-provisions': .1, 'episode_tree-increase': .5, 'theme_increase': .95 }));
assert.equal(mixed.fit, 'loose'); // One strong episode cannot certify the whole recipe.
const historical = composeFromAnswers(fixture({ 'aim_0': .96, 'episode_ram-release': .96 }));
check(historical);
assert.equal(historical.mode, 'historical');
assert.equal(ids(historical).at(-1), 'ashella/release-rams');

// New actions enter composition through object and speech links, without a curated episode.
const linked = composeFromAnswers(fixture({ 'chain_dandanku_address-maids': .96, 'theme_provision': .93 }));
check(linked);
assert.equal(linked.items[0].id, 'dandanku/gather-fodder-wool');
assert.equal(linked.items.at(-1).id, 'dandanku/address-maids');
assert.ok(linked.items.every((item) => item.grammarId === 'dandanku/address-maids'));
assert.ok(validateEpisodePlan(linked.items.slice(0, -1)).length);
assert.deepEqual(ids(decodeRitualRecipe(encodeRitualRecipe({ goal: 'provide for a new shop', ...linked }))), ids(linked));
const threshold = composeFromAnswers(fixture({ 'chain_zarpiya_speak-formula': .97, 'theme_protection': .92 }));
check(threshold);
assert.deepEqual(ids(threshold), ['zarpiya/take-implements', 'zarpiya/close-door', 'zarpiya/anoint-door', 'zarpiya/speak-formula']);
assert.ok(validateEpisodePlan(threshold.items.slice(1)).length);
const procreation = composeFromAnswers(fixture({ [`aim_${Object.keys(aims).indexOf('restore-procreative-power')}`]: .96, 'chain_paskuwatti_speak-exchange': .93 }));
check(procreation);
assert.equal(procreation.mode, 'historical');
assert.equal(ids(procreation).at(-1), 'paskuwatti/speak-exchange');
assert.ok(!ids(composeFromAnswers(fixture({ 'chain_paskuwatti_speak-exchange': .99, 'theme_increase': .99 }))).includes('paskuwatti/pass-gate'));

// Saved episodes restore the same instructions, semantics and displayed estimates.
const restored = decodeRitualRecipe(encodeRitualRecipe({ goal: 'open an ice cream shop 🍦', ...cleanse }));
assert.deepEqual(restored.items, cleanse.items.map(({ relevance, ...item }) => item));
assert.equal(instructionFor(restored.items[0]), instructionFor(cleanse.items[0]));
assert.throws(() => encodeRitualRecipe({ ...restored, items: restored.items.slice(1) }), /Invalid recipe/);
const oldToken = Buffer.from(JSON.stringify([2, 'old goal', 1, 2, [[shareIds.indexOf('tunnawiya/wash-with-water'), 0, 430]]])).toString('base64url');
assert.equal(decodeRitualRecipe(oldToken).items[0].jevProbability, .43);
const v3Token = Buffer.from(JSON.stringify([3, 'old goal', 1, 2, ['uhhamuwa/bring-food-drink', 'uhhamuwa/prepare-for-road-god'].map((id) => [shareIds.indexOf(id), 0, 500, 'road-provisions', 'general'])])).toString('base64url');
assert.equal(decodeRitualRecipe(v3Token).items.length, 2);
const shareToken = encodeRitualRecipe(restored);
const shareResponse = await shareHandler.fetch(new Request(`https://tuppi.example/r/${shareToken}`));
assert.equal(shareResponse.status, 200);
assert.match(await shareResponse.text(), /Wash yourself with water/);
// Broad distributions exercise ordering, support and sharing across all aim modes.
let seed = 17;
for (let trial = 0; trial < 120; trial++) {
  const random = fixture();
  for (const answer of Object.values(random)) { seed = (seed * 1664525 + 1013904223) >>> 0; answer.noul = seed / 4294967296; }
  const result = composeFromAnswers(random);
  check(result);
  assert.deepEqual(ids(decodeRitualRecipe(encodeRitualRecipe({ goal: 'a varied goal', ...result }))), ids(result));
}
assert.equal((await shareHandler.fetch(new Request('https://tuppi.example/r/bogus'))).status, 404);
const unsafeToken = encodeRitualRecipe({ ...restored, goal: '<img src=x onerror="alert(1)">' });
const unsafeHtml = await (await shareHandler.fetch(new Request(`https://tuppi.example/r/${unsafeToken}`))).text();
assert.ok(!unsafeHtml.includes('<img src=x onerror='));
assert.ok(unsafeHtml.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));

const answers = fixture({ 'episode_tree-increase': .99, 'theme_increase': .95 });
const answersResult = composeFromAnswers(answers);
const post = (goal) => new Request("http://localhost/api/compose", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ goal, engine: "episodes" }),
});
const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
const originalTypeSafeKey = process.env.TYPESAFE_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;
try {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.equal((await handler.fetch(post("undo a curse"))).status, 503);
  assert.equal((await handler.fetch(post("x"))).status, 400);
  process.env.OPENROUTER_API_KEY = "openrouter-test-only-key";
  process.env.TYPESAFE_API_KEY = "typesafe-test-only-key";
  let upstreamCalls = 0;
  globalThis.fetch = async (url, options) => {
    upstreamCalls += 1;
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(options.headers.Authorization, "Bearer openrouter-test-only-key");
    assert.equal(JSON.parse(options.body).model, "~typesafe/jev-latest");
    assert.equal(JSON.parse(options.body).state.user_goal, "test a plague request");
    return Response.json({ model: "jev-test", answers });
  };
  const response = await handler.fetch(post("test a plague request"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.items.map((item) => item.id), answersResult.items.map((item) => item.id));
  assert.equal(result.items[0].jevProbability, answersResult.items[0].jevProbability);
  assert.equal((await handler.fetch(post("test a plague request"))).status, 200);
  assert.equal(upstreamCalls, 1);

  delete process.env.OPENROUTER_API_KEY;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(options.headers.Authorization, "Bearer typesafe-test-only-key");
    assert.equal(JSON.parse(options.body).model, "jev-latest");
    return Response.json({ model: "jev-test", answers });
  };
  assert.equal((await handler.fetch(post("test the direct fallback"))).status, 200);
} finally {
  globalThis.fetch = originalFetch;
  if (originalOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
  if (originalTypeSafeKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalTypeSafeKey;
  if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAIKey;
}

console.log("Ritual composer request, ranking, prerequisites, and API checks passed.");
