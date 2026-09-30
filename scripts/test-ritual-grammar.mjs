import assert from 'node:assert/strict';
import { ATOMS, SCHEMA_IDS, proposeRituals, validatePlanItems, atomById } from '../src/lib/ritualPlanner.js';
import { compileGrammarSteps } from '../src/lib/ritualGrammarCards.js';
import { validateAtom, SCHEMAS, realizeAtom } from '../src/lib/ritualAtoms.js';
import { encodeGrammarRecipe, decodeAnyRitualRecipe, encodeRitualRecipe } from '../src/lib/ritualShare.js';
import { buildSchemaJevRequest, scoresFromJev, heuristicScores, combineScores, guardScores } from '../server/ritualGrammarComposer.js';
import { compileRitualSteps } from '../src/lib/ritualExecution.js';
import handler from '../api/compose.js';

// Atom layer
assert.ok(ATOMS.length > 400, 'atom index is populated');
for (const atom of ATOMS) assert.deepEqual(validateAtom(atom.atom, atom.id), [], atom.id);
const rituals = new Set(ATOMS.map((a) => a.ritualId));
const shared = new Map();
for (const a of ATOMS) shared.set(a.signature, new Set([...(shared.get(a.signature) ?? []), a.ritualId]));
assert.ok([...shared.values()].filter((set) => set.size > 1).length >= 30, 'signatures recur across rituals');
assert.ok(rituals.size >= 20);

// Planner: every schema, many draws. Material prerequisites and coherent source connections.
const BAD_TEXT = /undefined|null|\[object|NaN|\{|\}/;
let plans = 0;
for (const schema of SCHEMA_IDS) {
  for (let seed = 1; seed <= 12; seed++) {
    const { plans: [plan] } = proposeRituals({ schemaScores: { [schema]: 0.9 }, seed, samples: 8 });
    plans++;
    assert.ok(plan.items.length >= 2, `${schema}/${seed}: empty plan`);
    assert.deepEqual(validatePlanItems(plan.items), [], `${schema}/${seed}`);
    const cards = compileGrammarSteps({ goal: 'test goal', goalFrame: { outcome: 'a calmer week', wish: 'May you have a calmer week.', unwanted: 'the worry', method: 'luna' }, mode: 'analogy', items: plan.items });
    assert.ok(cards.length >= 2);
    assert.ok(cards.filter((card) => card.carriesWish).length <= 1, 'one speech carries the whole wish');
    for (const card of cards) {
      assert.ok(!BAD_TEXT.test(card.instruction), `${schema}/${seed}: ${card.instruction}`);
      if (card.kind === 'composed') assert.ok(card.words && !BAD_TEXT.test(card.words) && card.note.includes('not a translation'), card.words);
      assert.ok(card.provenance.ritualId && card.provenance.stepNumber > 0);
    }
  }
}
// Mixing traditions and several cores are allowed, and happen.
const mixed = proposeRituals({ schemaScores: { elimination: 0.9, healing: 0.85, passage: 0.8 }, seed: 3, samples: 30 });
assert.ok(mixed.plans[0].cores.length >= 2, 'several central operations');
const allCards = mixed.plans.flatMap((plan) => compileGrammarSteps({ goal: 'x y z', mode: 'analogy', items: plan.items }));
assert.ok(allCards.some((card) => card.seam), 'recombination across rituals');
// Whatever takes up the condition leaves.
for (let seed = 1; seed < 30; seed++) assert.equal(proposeRituals({ schemaScores: { elimination: 0.95 }, seed, samples: 6 }).plans[0].leftCharged, 0, `charged carrier left at seed ${seed}`);
// Deterministic for a seed.
assert.deepEqual(proposeRituals({ schemaScores: { stripping: 0.9 }, seed: 77 }).plans[0].items, proposeRituals({ schemaScores: { stripping: 0.9 }, seed: 77 }).plans[0].items);
assert.equal(realizeAtom({ verb: 'shape', theme: { class: 'clay' }, result: { class: 'figure', sub: 'ox', count: 2, f: { material: 'clay' } } }), 'Shape the clay into 2 clay oxen');

// A clearly matching historical aim leads with that ritual, in tablet order, with the wish in its petition.
const attested = proposeRituals({ schemaScores: { increase: 0.8 }, aimScores: { 'restore-procreative-power': 0.55, 'seek-descendants': 0.7 }, seed: 3 });
assert.ok(attested.plans[0].attested === 'paskuwatti', 'Paškuwatti leads for procreative power');
const attestedCards = compileGrammarSteps({ goal: 'more procreative power', goalFrame: { outcome: 'more procreative power', wish: 'May you have more procreative power.', method: 'luna' }, mode: 'analogy', items: attested.plans[0].items });
assert.ok(attestedCards.some((card) => card.carriesWish && /Uliliya/.test(card.words)));
assert.ok(attested.plans.length > 1, 'recombinations remain as alternatives');
// Thin readings still produce a rite of substance.
assert.ok(proposeRituals({ schemaScores: { increase: 0.8, petition: 0.3, provision: 0.25 }, seed: 8 }).plans[0].items.length >= 5);

// Jev request is fixed-size: schemas + aims, independent of library growth.
const jev = buildSchemaJevRequest('I want my garden to grow');
assert.equal(Object.keys(jev.questions).filter((k) => k.startsWith('schema_')).length, SCHEMA_IDS.length);
const answers = Object.fromEntries(Object.keys(jev.questions).map((k) => [k, { noul: k === 'schema_increase' ? 0.9 : 0.1 }]));
const scores = scoresFromJev(answers);
assert.equal(scores.schemaScores.increase, 0.9);
assert.throws(() => scoresFromJev({}), /Invalid Jev answer/);
assert.ok(combineScores(scores, ['passage']).schemaScores.passage < 0.25, 'with Jev, Luna only nudges');
assert.ok(combineScores(scores, ['passage'], { floor: true }).schemaScores.passage >= 0.75, 'without Jev, Luna sets a floor');
const guarded = guardScores({ aimScores: {}, schemaScores: { return: 0.9, appeasement: 0.1 } }, { relationship: { person: 'your brother', kind: 'reconciliation' } });
assert.equal(guarded.schemaScores.return, 0.9, 'named people do not suppress requested ritual mechanisms');
assert.equal(guarded.schemaScores.appeasement, 0.1);
assert.ok(heuristicScores('I want to get rid of my bad luck').schemaScores.elimination > 0.5);

// Share links: v8 round trip; legacy links still decode.
const recipe = { goal: 'a calmer week', mode: 'analogy', fit: 'clear', goalFrame: { outcome: 'a calmer week', wish: 'May you have a calmer week.', unwanted: 'the worry', method: 'luna' }, items: mixed.plans[0].items };
const decoded = decodeAnyRitualRecipe(encodeGrammarRecipe(recipe));
assert.equal(decoded.engine, 'grammar');
assert.deepEqual(decoded.items.map((i) => i.atomId), recipe.items.map((i) => i.atomId));
assert.equal(compileRitualSteps(decoded).length, compileGrammarSteps(recipe).length);
const legacy = encodeRitualRecipe({ goal: 'undo a curse', mode: 'preview', fit: 'clear', items: [{ id: 'allii/set-basket', unitId: 'allii-set-basket', reason: 'matched' }] });
assert.equal(decodeAnyRitualRecipe(legacy).items[0].id, 'allii/set-basket');
assert.throws(() => decodeAnyRitualRecipe(encodeGrammarRecipe(recipe).slice(0, 30) + 'x'));

// API: with no model configured, a labelled offline estimate still composes.
const saved = { ...process.env };
delete process.env.OPENROUTER_API_KEY; delete process.env.TYPESAFE_API_KEY; delete process.env.OPENAI_API_KEY;
const post = (goal, extra = {}) => handler.fetch(new Request('http://localhost/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `grammar-${Math.random()}` }, body: JSON.stringify({ goal, engine: "grammar", ...extra }) }));
let response = await post('I want to get rid of my bad luck', { seed: 5 });
let body = await response.json();
assert.equal(response.status, 200);
assert.equal(body.engine, 'grammar');
assert.equal(body.scoring, 'offline');
assert.ok(body.executionSteps.length >= 3 && body.alternatives.length >= 1);
// With Jev and Luna mocked, both are called once and in parallel.
process.env.OPENROUTER_API_KEY = 'test-jev'; process.env.OPENAI_API_KEY = 'test-openai';
const realFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push(String(url));
  const request = JSON.parse(options.body);
  if (String(url).includes('openrouter')) return Response.json({ model: 'jev-test', answers: Object.fromEntries(Object.keys(request.questions).map((k) => [k, { noul: k === 'schema_passage' ? 0.88 : 0.05 }])) });
  return Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ outcome: 'a good start at the new school', wish: 'May you have a good start at the new school.', relationship: null, unwanted: null, structures: ['passage'] }) }] }] });
};
response = await post('I start at a new school next week', { seed: 9 });
body = await response.json();
globalThis.fetch = realFetch;
Object.assign(process.env, saved);
assert.equal(body.scoring, 'jev');
assert.equal(calls.length, 2);
assert.ok(body.cores.some((core) => core.id === 'passage'));
assert.ok(body.executionSteps.some((step) => /Pass|threshold/i.test(step.instruction + (step.words ?? ''))));
assert.ok(body.executionSteps.some((step) => step.carriesWish && /new school/.test(step.words)));
console.log(`Grammar: ${ATOMS.length} atoms in ${shared.size} signatures across ${rituals.size} rituals; ${plans} plans over ${SCHEMA_IDS.length} schemas; share v8, offline and mocked Jev/Luna API checks passed.`);
