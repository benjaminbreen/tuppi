import assert from 'node:assert/strict';
import { proceduralGoalFrame, normalizeGoalFrame } from '../src/lib/ritualGoal.js';
import { compileRitualSteps } from '../src/lib/ritualExecution.js';
import { encodeRitualRecipe, decodeRitualRecipe } from '../src/lib/ritualShare.js';
import { resolveGoalWording, buildWordingRequest } from '../server/ritualWording.js';
const goal = 'How do I make my mother not be mad at me';
const frame = proceduralGoalFrame(goal);
assert.equal(frame.relationship.person, 'your mother');
assert.equal(proceduralGoalFrame('I want my mother to stop being angry at me but not forgive me'), null);
assert.equal(proceduralGoalFrame('I want my mother to be happy'), null);
const recipe = { goal, goalFrame: frame, executionVersion: 4, mode: 'analogy', fit: 'clear',
  items: ['tunnawiya/hold-clay-tongue','tunnawiya/libate-sun-god'].map(id => ({id, unitId: id.replace('/', '-'), reason: 'manual'})) };
const steps = compileRitualSteps(recipe);
assert.match(steps[0].instruction, /over you/);
assert.doesNotMatch(steps[0].instruction, /over your mother/);
const speech = steps.filter(x => x.words).map(x => x.words).join(' ');
assert.match(speech, /their mother/);
assert.match(speech, /without anger/);
assert.doesNotMatch(speech, /ritual patron|your mother/); // Divine addressee must not become the mother’s child.
assert.deepEqual(compileRitualSteps(decodeRitualRecipe(encodeRitualRecipe(recipe))), steps);
assert.ok(!compileRitualSteps({...recipe, mode: 'historical'}).some(x => x.kind === 'composed'));
assert.ok(!compileRitualSteps({...recipe, executionVersion: 3}).some(x => x.words?.includes('mother')));
const noPattern = compileRitualSteps({...recipe, items: [recipe.items[0]]});
assert.match(noPattern.at(-1).words, /your mother/);
assert.match(noPattern.at(-1).note, /not a quotation/);
const rachel = {...frame, relationship: {person:'Ms Rachel',kind:'cooperation'}, wish:'May Ms Rachel make a new episode.'};
assert.doesNotMatch(compileRitualSteps({...recipe, goalFrame:rachel}).filter(x=>x.words).map(x=>x.words).join(' '), /Let anger/);
assert.throws(()=>normalizeGoalFrame({...frame,relationship:{person:'mother',kind:'enemy'}}));
let calls = 0;
const result = await resolveGoalWording('Please help me reconcile with my colleague Sam', {apiKey:'fake',fetchImpl:async()=>{
  calls++;
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({outcome:'reconciliation with Sam',wish:'May you reconcile with Sam.',relationship:{person:'Sam',kind:'reconciliation'}})}]}]});
}});
assert.equal(calls,1);
assert.equal(result.goalFrame.relationship.person,'Sam');
assert.ok(buildWordingRequest(goal).text.format.schema.required.includes('relationship'));
console.log('Participant binding, relationship agency, closure-only wishes, share persistence, old recipes and one-call normalization passed.');
console.log(speech);
