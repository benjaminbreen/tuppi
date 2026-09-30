import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ATOMS,planRitual,validatePlanItems} from '../src/lib/ritualPlanner.js';
import {ACTION_MEANINGS} from '../src/lib/ritualActionMeaning.js';
import {ELIGIBLE_ACTIONS,buildActionRequest,splitActionRequest} from '../server/ritualActionComposer.js';
const roles={}, mechanisms={}, inaccessible=[];
for(const a of ATOMS) {
 const m=ACTION_MEANINGS[a.id];
 assert.ok(m?.logic && m.purpose.length && m.tags.length && m.evidence.source);
 assert.ok(['prepare','central','complete'].includes(m.role));
 roles[m.role]=(roles[m.role]??0)+1;
 for(const tag of m.tags)mechanisms[tag]=(mechanisms[tag]??0)+1;
}
for(const a of ELIGIBLE_ACTIONS) {
 const p=planRitual({schemaScores:{petition:1},aimScores:{},seed:73,actionScores:{[a.id]:1},focusActionId:a.id});
 if(!p.items.some(i=>i.atomId===a.id)||p.items.length>16||p.leftCharged||validatePlanItems(p.items).length)inaccessible.push({id:a.id,length:p.items.length,leftCharged:p.leftCharged});
}
const request=buildActionRequest('I want a new car');
const report={sourceActions:ATOMS.length,eligibleActions:ELIGIBLE_ACTIONS.length,roles,mechanisms,payloadCharacters:JSON.stringify(request).length,batchQuestions:splitActionRequest(request).map(r=>Object.keys(r.questions).length),reachable:ELIGIBLE_ACTIONS.length-inaccessible.length,inaccessible};
fs.mkdirSync('research/ritual-action-audit',{recursive:true});
fs.writeFileSync('research/ritual-action-audit/meaning-coverage.json',JSON.stringify(report,null,2));
fs.writeFileSync('src/data/rituals/action-meanings.json',JSON.stringify(ACTION_MEANINGS,null,2)+'\n');
console.log(JSON.stringify(report));
assert.equal(inaccessible.length,0,'Some eligible actions cannot enter a valid focused chain');
