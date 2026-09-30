import assert from 'node:assert/strict';
import {encodeGrammarRecipe,decodeAnyRitualRecipe} from '../src/lib/ritualShare.js';
import {compileGrammarSteps} from '../src/lib/ritualGrammarCards.js';
import { ATOMS, atomById, validatePlanItems } from '../src/lib/ritualPlanner.js';
import { buildActionRequest, splitActionRequest, ELIGIBLE_ACTIONS, actionScoresFromAnswers, proposeActionPlans, buildActionReviewRequest, selectReviewedPlans, renderActionRecipe } from '../server/ritualActionComposer.js';
const request=buildActionRequest('I want a new car');
assert.equal(Object.keys(request.questions).filter(k=>k.startsWith('action_')).length,ELIGIBLE_ACTIONS.length);
// Guard the payload shape against reintroducing repeated provenance and prompts.
const payload = JSON.stringify(request);
assert.ok(payload.length < 400_000, `First pass grew to ${payload.length} characters`);
assert.ok(!/tlhdig-hittite|unreviewed drafts|Preserve agency|negation|attestation/.test(payload));
assert.ok(!request.state.sources);
assert.ok(request.questions.action_0.instructions.candidate.logic);
assert.ok(!request.questions.action_0.instructions.candidate.source);
const answers=Object.fromEntries(Object.entries(request.questions).map(([id,q])=>[id,q.type==='score'?{score:2}:{noul:id==='schema_passage'?.9:.1}]));
const scores=actionScoresFromAnswers(answers);
assert.equal(Object.keys(scores.actionScores).length,ELIGIBLE_ACTIONS.length);
assert.throws(()=>actionScoresFromAnswers({...answers,action_0:{score:9}}),/Invalid Jev/);
const frame={wish:'May you receive a new car.',outcome:'a new car',method:'luna'};
const proposal=proposeActionPlans(scores,73,frame);
assert.ok(proposal.plans.length>1 && proposal.plans.length<=8);
const review=buildActionReviewRequest('I want a new car',proposal,frame);
assert.equal(Object.keys(review.questions).length,proposal.plans.length*3);
assert.ok(review.state.plans.plan_0);
assert.ok(!('sourceContext' in review.questions.plan_0_goal.instructions));
const reviewAnswers=Object.fromEntries(Object.keys(review.questions).map(id=>[id,{score:id.startsWith('plan_0_')?2.9:2.6}]));
const plans=selectReviewedPlans(proposal,reviewAnswers,73);
const result=renderActionRecipe({goal:'I want a new car',scores,goalFrame:frame,seed:73,plans});
assert.equal(result.composer,'jev-actions-v1');
assert.ok(result.items.every(i=>i.jevProbability==null && i.jevActionScore===2));
assert.deepEqual(validatePlanItems(result.items),[]);
assert.ok(result.executionSteps.every(s=>atomById.has(s.atomIds[0])));
// An action absent from schema match patterns is still reachable as a focus.
const target=ELIGIBLE_ACTIONS.find(a=>a.atom.verb==='comb');
const focused={...scores,actionScores:Object.fromEntries(ELIGIBLE_ACTIONS.map(a=>[a.id,a.id===target.id?1:0]))};
assert.ok(proposeActionPlans(focused,73,frame).plans.some(p=>p.items.some(i=>i.atomId===target.id)));
// Repeated draws are reproducible and can choose different approved alternatives.
assert.deepEqual(selectReviewedPlans(proposal,reviewAnswers,73),selectReviewedPlans(proposal,reviewAnswers,73));
assert.ok(new Set(Array.from({length:30},(_,seed)=>selectReviewedPlans(proposal,reviewAnswers,seed)[0].items.map(i=>i.atomId).join('|'))).size>1);
console.log(`Action composer: ${ATOMS.length} source actions, ${ELIGIBLE_ACTIONS.length} assessed candidates; full-library request, scoring, focused reachability, reviews and varied selection passed.`);
// Mocked endpoint contract: two Jev calls, optional wording, then cached reviewed draws.
const {default:handler}=await import('../api/compose.js');
const realFetch=globalThis.fetch;
const oldKey=process.env.OPENROUTER_API_KEY, oldOpenAI=process.env.OPENAI_API_KEY;
process.env.OPENROUTER_API_KEY='mock';delete process.env.OPENAI_API_KEY;
let calls=0;
globalThis.fetch=async(url,options)=>{
  calls++;const payload=JSON.parse(options.body);
  return Response.json({model:'mock-jev',answers:Object.fromEntries(Object.entries(payload.questions).map(([id,q])=>[id,q.type==='score'?{score:2.5}:{noul:id==='schema_passage'?.9:.1}]))});
};
try {
 const post=seed=>handler.fetch(new Request('http://localhost/api/compose',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'actions-mock'},body:JSON.stringify({goal:'a new car for mock testing',engine:'actions',seed})}));
 const response=await post(4);const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.composer,'jev-actions-v1');assert.equal(body.planning.jevCalls,2);assert.equal(calls,2);
 const second=await(await post(5)).json();assert.equal(second.planning.cached,true);assert.equal(calls,3);assert.equal(second.planning.jevCalls,1);
} finally {globalThis.fetch=realFetch;if(oldKey==null)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=oldKey;if(oldOpenAI==null)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldOpenAI;}
console.log('Mocked endpoint: Jev action assessment, chain review and cached redraw passed.');

const spoken=structuredClone(result);if(!spoken.items.some(i=>atomById.get(i.atomId).atom.verb==='speak'))spoken.items.push({atomId:'tunnawiya/wish-by-tree#0',reason:'manual',schema:'increase',slot:'manual'});const speech=spoken.items.find(i=>atomById.get(i.atomId).atom.verb==='speak');speech.words='Sun-god, as this tree bears fruit, may my bakery thrive.';
assert.deepEqual(compileGrammarSteps(decodeAnyRitualRecipe(encodeGrammarRecipe(spoken))).map(c=>c.words),compileGrammarSteps(spoken).map(c=>c.words));
assert.throws(()=>encodeGrammarRecipe({...spoken,items:spoken.items.map(i=>({...i,words:'<invalid>'}))}),/Invalid recipe speech/);
console.log('Source-specific spoken words survive sharing; malformed speech rejected.');

const {buildIntentRequest,intentScores,proposeFastPlans,buildFastReview}=await import('../server/ritualFastComposer.js');
const compact=buildIntentRequest('I want my bakery to thrive');
assert.ok(JSON.stringify(compact).length<14000);
assert.ok(Object.keys(compact.questions).length >= 31);
const intent=intentScores(Object.fromEntries(Object.keys(compact.questions).map(id=>[id,{score:2}])));
assert.equal(Object.keys(intent.actionScores).length,ELIGIBLE_ACTIONS.length);
const draws=Array.from({length:40},(_,seed)=>proposeFastPlans(intent,seed));
assert.ok(new Set(draws.flatMap(p=>p.plans.flatMap(p=>p.items.map(i=>i.atomId)))).size>80,'Candidate exploration is too narrow');
assert.ok(draws.every(p=>p.plans.length<=6 && p.plans.every(p=>p.items.length<=16 && (c=>c.length>=4 && c.filter(x=>x.kind==='source').length>=3 && c.filter(x=>x.kind==='composed').length<=2)(compileGrammarSteps({goal:'good things',items:p.items,mode:'analogy'})))));
const recentGrowth=['tunnawiya/take-cow-by-horn#0','tunnawiya/wish-for-offspring#0'];
assert.ok(proposeFastPlans(intent,4,recentGrowth).plans.every(p=>!p.items.some(i=>recentGrowth.includes(i.atomId))));
assert.ok(JSON.stringify(buildFastReview('I want my bakery to thrive',draws[0])).length<18000);
const increase={...intent,actionScores:Object.fromEntries(ELIGIBLE_ACTIONS.map(a=>[a.id,a.function==='seek-fertility'?1:0]))};
const growth=proposeFastPlans(increase,1);
assert.ok(growth.plans.some(p=>p.items.some(i=>i.atomId==='tunnawiya/wish-by-tree#0')&&p.items.some(i=>i.atomId==='tunnawiya/touch-fruit-tree#0')),'Tree comparison lost its gesture');
console.log('Compact intent, six-chain review, broad seeded exploration and source speech prerequisites passed.');

const physicalPrayer={...spoken,goalFrame:{...spoken.goalFrame,prayer:'Let this new beginning open before me.'}};assert.deepEqual(compileGrammarSteps(decodeAnyRitualRecipe(encodeGrammarRecipe(physicalPrayer))).map(c=>c.words),compileGrammarSteps(physicalPrayer).map(c=>c.words));

// Source actions retain their materials and operations, including unusual acts.
const {planRitual,HISTORICAL_ONLY}=await import('../src/lib/ritualPlanner.js');
assert.ok(ATOMS.every(a=>!HISTORICAL_ONLY(a.atom)));
for(const id of ['hittite-remedies/gut-fish#1',...ATOMS.filter(a=>['kill','ingest','apply'].includes(a.atom.verb)).slice(0,8).map(a=>a.id)]) {
 const plan=planRitual({schemaScores:{petition:1},focusActionId:id,actionScores:{[id]:1},seed:7});
 const item=plan.items.find(i=>i.atomId===id);
 assert.ok(item,`Source operation omitted: ${id}`);
 assert.ok(!item.substitute,`Source material rewritten: ${id}`);
 const card=compileGrammarSteps({items:plan.items,goal:'test'}).find(c=>c.atomIds.includes(id));
 assert.ok(card);
 assert.ok(!card.notes.some(n=>/Do not eat|dough figure stands/.test(n)));
}
console.log('Source fidelity: all 561 operations eligible; fish, sacrifice and remedies retain their source acts.');
