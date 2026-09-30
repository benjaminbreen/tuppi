import index from '../src/data/rituals/composition-index.json' with {type:'json'};
import assert from 'node:assert/strict';
import { compileRitualSteps } from '../src/lib/ritualExecution.js';
import { ritualInterpretation, EXPRESSIONS } from '../src/lib/ritualExpression.js';
import { encodeRitualRecipe, decodeRitualRecipe } from '../src/lib/ritualShare.js';
for (const id of Object.keys(EXPRESSIONS)) {
 const recipe = {executionVersion:5,mode:'analogy',fit:'loose',goal:'sell a screenplay to MGM',goalFrame:{outcome:'a screenplay sale to MGM',wish:'May you sell a screenplay to MGM.',method:'luna'},items:[{id,unitId:index.find(item=>`${item.ritualId}/${item.stepId}`===id).unitId,reason:'manual'}]};
 const steps=compileRitualSteps(recipe);
 const speech=steps.find(x=>x.words);
 assert.ok(speech.carriesWish,id);
 assert.match(speech.words,/sell a screenplay to MGM/);
 assert.ok(speech.words.length<300,id);
 assert.equal(ritualInterpretation(recipe,steps).sourceId,id);
 assert.deepEqual(compileRitualSteps(decodeRitualRecipe(encodeRitualRecipe(recipe))),steps);
 const negative=compileRitualSteps({...recipe,goalFrame:{...recipe.goalFrame,wish:'May Ms Rachel not cancel the new episode.'}}).find(x=>x.words);
 assert.match(negative.words,/Ms Rachel not cancel/);
 assert.equal(ritualInterpretation({...recipe,mode:'historical'},steps),null);
}
console.log('Action-specific speech, source-grounded interpretations, agency, negation and v5 share persistence passed.');
