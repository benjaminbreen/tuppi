import assert from "node:assert/strict";
import { buildJevRequest, composeFromAnswers, occurrences } from "../server/ritualComposer.js";
import handler from "../api/compose.js";
import shareHandler from "../api/share.js";
import { decodeRitualRecipe, encodeRitualRecipe } from "../src/lib/ritualShare.js";
import shareIds from "../src/data/rituals/ritual-share-ids.json" with { type: "json" };

const request = buildJevRequest("undo a curse");
assert.equal(request.model, "jev-latest");
assert.equal(request.state.user_goal, "undo a curse");
assert.equal(Object.keys(request.questions).length, 4 + 14 + occurrences.length);
assert.equal(request.questions.step_0.type, "noul");
assert.ok(request.questions.step_0.instructions.source_excerpt);
assert.ok(request.questions.step_0.instructions.possible_metaphorical_role);
assert.equal(request.questions.lens_visibility.type, "noul");
assert.equal(new Set(shareIds).size, shareIds.length);
assert.ok(occurrences.every((item) => shareIds.includes(item.id)));

const answers = Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: 0.02 }]));
assert.deepEqual(composeFromAnswers(answers), { mode: "analogy", items: [], fit: "loose" });

answers.aim_0.noul = 0.96; // avert plague
const wreath = occurrences.find((item) => item.id === "uhhamuwa/make-wreath");
assert.ok(wreath);
answers[wreath.questionId].noul = 0.99;
const historical = composeFromAnswers(answers);
assert.equal(historical.mode, "historical");
assert.equal(historical.fit, "historical");
assert.deepEqual(historical.items.map((item) => item.id), ["uhhamuwa/twist-wool", "uhhamuwa/make-wreath"]);
assert.equal(historical.items[0].reason, "prerequisite");
assert.equal(historical.items[0].jevProbability, 0.02);
assert.equal(historical.items[1].jevProbability, 0.99);
assert.notEqual(historical.items[1].relevance, historical.items[1].jevProbability);

answers.aim_0.noul = 0.02;
const analogy = composeFromAnswers(answers);
assert.equal(analogy.mode, "analogy");
assert.deepEqual(analogy.items.map((item) => item.id), ["uhhamuwa/twist-wool", "uhhamuwa/make-wreath"]);
assert.equal(analogy.fit, "clear");
assert.throws(() => composeFromAnswers({}), /Invalid Jev answer/);

const modern = Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: 0.03 }]));
modern.lens_growth.noul = 0.95;
modern.lens_prosperity.noul = 0.93;
const tree = occurrences.find((item) => item.id === "tunnawiya/touch-fruit-tree");
assert.ok(tree);
modern[tree.questionId].noul = 0.84;
const lottery = composeFromAnswers(modern);
assert.equal(lottery.mode, "analogy");
assert.equal(lottery.fit, "clear");
assert.ok(lottery.items.some((item) => item.id === tree.id));
assert.equal(lottery.items.find((item) => item.id === tree.id).matchedLens, "growth");
assert.ok(!lottery.items.some((item) => occurrences.find((part) => part.id === item.id)?.function === "kill-for-offering"));
assert.ok(!lottery.items.some((item) => item.id === "pulisa/select-substitutes"));

const shareToken = encodeRitualRecipe({ goal: "win the lottery 🍀", mode: "analogy", fit: lottery.fit, items: lottery.items });
const restored = decodeRitualRecipe(shareToken);
assert.equal(restored.goal, "win the lottery 🍀");
assert.deepEqual(restored.items.map((item) => item.id), lottery.items.map((item) => item.id));
assert.equal(restored.items.find((item) => item.id === tree.id).jevProbability, 0.84);
assert.throws(() => decodeRitualRecipe("not-a-recipe"), /Invalid recipe/);
assert.throws(() => encodeRitualRecipe({ ...restored, items: [...restored.items, restored.items[0]] }), /Invalid recipe/);
const shareResponse = await shareHandler.fetch(new Request(`https://tuppi.example/r/${shareToken}`));
assert.equal(shareResponse.status, 200);
const shareHtml = await shareResponse.text();
assert.match(shareHtml, /og:title/);
assert.match(shareHtml, /win the lottery 🍀/);
assert.match(shareHtml, /rituals\/create\?recipe=/);
assert.equal((await shareHandler.fetch(new Request("https://tuppi.example/r/bogus"))).status, 404);
const unsafeToken = encodeRitualRecipe({ ...restored, goal: '<img src=x onerror="alert(1)">' });
const unsafeHtml = await (await shareHandler.fetch(new Request(`https://tuppi.example/r/${unsafeToken}`))).text();
assert.ok(!unsafeHtml.includes('<img src=x onerror='));
assert.ok(unsafeHtml.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));

const post = (goal) => new Request("http://localhost/api/compose", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ goal }),
});
const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
const originalTypeSafeKey = process.env.TYPESAFE_API_KEY;
const originalFetch = globalThis.fetch;
try {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
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
  assert.deepEqual(result.items.map((item) => item.id), analogy.items.map((item) => item.id));
  assert.equal(result.items[1].jevProbability, 0.99);
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
}

console.log("Ritual composer request, ranking, prerequisites, and API checks passed.");
