// Live audit. Usage: node --env-file=.env.local scripts/evaluate-ritual-actions.mjs --repeats=3
// Each distinct wish batches Jev assessment, phrases speeches and reviews chains; repeats reuse judgments.
import fs from 'node:fs';
import path from 'node:path';
import handler from '../api/compose.js';
import { ATOMS, atomById, validatePlanItems } from '../src/lib/ritualPlanner.js';
import { ELIGIBLE_ACTIONS } from '../server/ritualActionComposer.js';
import { compileGrammarSteps } from '../src/lib/ritualGrammarCards.js';
import { encodeGrammarRecipe, decodeAnyRitualRecipe } from '../src/lib/ritualShare.js';
import assert from 'node:assert/strict';
const repeats = Number(process.argv.find(a => a.startsWith('--repeats='))?.split('=')[1] ?? 1);
if(!Number.isInteger(repeats) || repeats < 1 || repeats > 100) throw new Error('repeats must be 1–100');
const custom = process.argv.slice(2).filter(a => !a.startsWith('--'));
const goals = custom.length ? custom : [
  'I want a new car', 'I want my enemy at work to get fired', 'Give me a million dollars',
  'I want to get an A in world history', 'I want my bakery to thrive', 'I want to stop biting my nails',
  'I want to make up with my sister', 'I want to sleep without nightmares',
  'I want to feel confident starting my new job', 'I want my lost cat to come home',
];
const results = [], selected = new Set(), offered = new Set(), sources = new Set(), frequencies = {}, candidateFit = {};
for (const [index, goal] of goals.entries()) for(let repeat=0;repeat<repeats;repeat++) {
  const start = performance.now();
  const response = await handler.fetch(new Request('http://localhost/api/compose', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `audit-${index}` }, body: JSON.stringify({goal, engine:'actions', seed:1000+index*97+repeat*7919}) }));
  const recipe = await response.json();
  if(!response.ok || recipe.composer !== 'jev-actions-v1') {
    results.push({goal, repeat, error:recipe.error ?? 'Live Jev action engine unavailable'}); console.log(JSON.stringify(results.at(-1))); continue;
  }
  assert.deepEqual(validatePlanItems(recipe.items), []);
  const restored = decodeAnyRitualRecipe(encodeGrammarRecipe(recipe));
  assert.deepEqual(compileGrammarSteps(restored).map(c=>[c.instruction,c.words]), recipe.executionSteps.map(c=>[c.instruction,c.words]));
  for(const item of recipe.items) { selected.add(item.atomId); sources.add(atomById.get(item.atomId).ritualId); frequencies[item.atomId]=(frequencies[item.atomId]??0)+1; }
  for(const plan of [{items:recipe.items},...recipe.alternatives]) for(const item of plan.items) offered.add(item.atomId);
  for(const [id,s] of Object.entries(recipe.actionScores)) candidateFit[id] = Math.max(candidateFit[id]??0,s);
  const result = {goal,title:recipe.goalFrame?.title,repeat,elapsedMs:Math.round(performance.now()-start),fit:recipe.fit,planning:recipe.planning,wording:recipe.wording,
    chain:recipe.executionSteps.map(c=>c.kind==='composed'?c.title:c.instruction).join(' --> '),
    sources:[...new Set(recipe.executionSteps.map(c=>c.provenance.ritualName))],
    actionIds:recipe.items.map(i=>i.atomId), prayer:recipe.executionSteps.find(c=>c.carriesWish)?.words,
    alternativeChains:recipe.alternatives.map(p=>compileGrammarSteps({...recipe,items:p.items}).map(c=>c.kind==='composed'?c.title:c.instruction).join(' --> ')),
  };
  results.push(result); console.log(JSON.stringify(result));
}
const units=JSON.parse(fs.readFileSync('src/data/rituals/units.json'));
const steps=JSON.parse(fs.readFileSync('src/data/rituals/composition-index.json'));
const summary = {requests:results.length,successful:results.filter(r=>!r.error).length,libraryActions:ATOMS.length,eligibleActions:ELIGIBLE_ACTIONS.length,
  excludedHistoricalActions:ATOMS.length-ELIGIBLE_ACTIONS.length,catalogueTasks:Object.keys(units).length,sourceSteps:steps.length,
  sourceRituals:new Set(ATOMS.map(a=>a.ritualId)).size,actionSignatures:new Set(ATOMS.map(a=>a.signature)).size,
  locallyMatchedActions:Object.keys(candidateFit).length,jevAssessedMechanisms:results.find(r=>!r.error)?.planning.assessedMechanisms??0,selectedActions:selected.size,offeredActions:offered.size,selectedRituals:sources.size,
  neverOffered:ELIGIBLE_ACTIONS.filter(a=>!offered.has(a.id)).map(a=>({id:a.id,title:a.stepTitle,bestFit:candidateFit[a.id]??null})),
  mostSelected:Object.entries(frequencies).sort((a,b)=>b[1]-a[1]).slice(0,15),
};
const directory='research/ritual-action-audit'; fs.mkdirSync(directory,{recursive:true});
const destination=path.join(directory,'latest.json');fs.writeFileSync(destination,JSON.stringify({summary,results},null,2));
fs.writeFileSync(path.join(directory,'latest.txt'),results.map(r=>`${r.goal}\n${r.error??r.chain}\n${r.error?'':`Sources: ${r.sources.join(', ')}\nReview: ${JSON.stringify(r.planning.review)}; ${r.elapsedMs} ms\nPrayer: ${r.prayer??'(no wish-bearing speech)'}`}`).join('\n\n')+`\n\n${JSON.stringify({...summary,neverOffered:summary.neverOffered.length},null,2)}\n`);
console.log(JSON.stringify({...summary,neverOffered:summary.neverOffered.length,report:destination}));
if(results.some(r=>r.error)) process.exitCode=1;
