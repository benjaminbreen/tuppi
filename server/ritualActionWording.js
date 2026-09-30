import { atomById } from '../src/lib/ritualPlanner.js';
import { ACTION_MEANINGS } from '../src/lib/ritualActionMeaning.js';
import { compileGrammarSteps } from '../src/lib/ritualGrammarCards.js';
import { entityLabel } from '../src/lib/ritualAtoms.js';
import { WORDING_MODEL } from './ritualWording.js';

// One selected prayer only. No alternatives, goal-normalization call or JSON schema.
export async function wordActionPlans(goal, proposal, goalFrame, signal) {
 if(!process.env.OPENAI_API_KEY)return {status:'templates'};
 const plan=proposal.plans[0];
 const cards=compileGrammarSteps({goal,goalFrame,mode:'analogy',items:plan.items});
 const card=cards.find(c=>c.carriesWish)??cards.find(c=>c.kind==='composed')??cards.find(c=>c.atomIds.some(id=>ACTION_MEANINGS[id].role==='central'))??cards[0];
 const item=plan.items.find(i=>card.atomIds.includes(i.atomId));
 const a=atomById.get(item.atomId), meaning=ACTION_MEANINGS[a.id];
 const begin=performance.now();
 try {
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal,body:JSON.stringify({
   model:WORDING_MODEL,reasoning:{effort:'none'},max_output_tokens:140,
   input:[{role:'system',content:'Give this ritual a memorable, playful title of at most 8 words and one vivid spoken prayer of at most 25 words. Express only the requested wish through the image as a symbolic comparison. Keep the named recipient. Customize the prayer to the requested wish; preserve source imagery and do not import unrelated ancient aims. Return only JSON with strings "title" and "prayer".'},{role:'user',content:JSON.stringify({wish:goal,recipient:card.addressee??a.recipient??"those present",mechanism:meaning.tags[0],image:entityLabel(a.atom.about??a.atom.theme,{adapted:false,substitute:item.substitute}),action:card.instruction})}]
  })});
  if(!response.ok)throw new Error('wording unavailable');
  const data=await response.json();if(data.status!=='completed')throw new Error('wording incomplete');
  const text=(data.output??[]).filter(o=>o.type==='message').flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('').trim();
  const {title,prayer:words}=JSON.parse(text);
  if(typeof title!=='string'||title.length<3||title.length>100||/[<>\u0000-\u001f]/.test(title))throw new Error('invalid title');
  if(typeof words!=='string'||words.length<3||words.length>600||/[<>\u0000-\u001f]/.test(words))throw new Error('invalid wording');
  goalFrame.title=title;
  if(a.atom.verb==='speak')item.words=words;else goalFrame.prayer=words;
  return {status:'luna-action-speeches',model:WORDING_MODEL,speeches:1,elapsedMs:Math.round(performance.now()-begin),usage:data.usage??null};
 }catch(error){return {status:'templates',reason:signal.aborted?'wording-timeout':'action-wording-unavailable',elapsedMs:Math.round(performance.now()-begin)};}
}
