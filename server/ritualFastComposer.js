import {ELIGIBLE_ACTIONS, actionContext} from './ritualActionComposer.js';
import {planRitual,atomById,mulberry32,validatePlanItems} from '../src/lib/ritualPlanner.js';
import {compileGrammarSteps} from '../src/lib/ritualGrammarCards.js';
import {SCHEMAS} from '../src/lib/ritualAtoms.js';
const TEMPERATURE=.12;
const signatureCount=new Map();
for(const a of ELIGIBLE_ACTIONS)signatureCount.set(a.signature,(signatureCount.get(a.signature)??0)+1);
const maxIdf=Math.log(ELIGIBLE_ACTIONS.length);
// 0 for the most common kind of act, 1 for a kind attested once.
export const rarity=a=>Math.log(ELIGIBLE_ACTIONS.length/signatureCount.get(a.signature))/maxIdf;
const schemaFor={'analogy of increase':'increase','gift exchange':'provision','appeasement':'appeasement','restitution':'appeasement','constrain opponent':'return','return to sender':'return','burden transfer':'elimination','substitution and expulsion':'elimination','protective boundary':'protection','cleansing':'healing','cleansing analogy':'healing','role exchange':'transformation','transition':'passage','divination':'sign','reveal hidden cause':'sign'};
const mechanisms=[...new Set(ELIGIBLE_ACTIONS.flatMap(a=>actionContext(a).tags))].filter(t=>!['preparation','offering preparation','load carrier','ritual setting'].includes(t));
export function buildIntentRequest(goal) {
 return {model:'jev-latest',state:{wish:goal},questions:Object.fromEntries(mechanisms.map((tag,i)=>[`mechanism_${i}`,{type:'score',instructions:`How well could ${tag} express this wish symbolically? Keep its intended subject and change; do not invent illness or sorcery.`,criteria:['Unrelated','Possible support','Useful approach','Strong central approach']}]))};
}
export function intentScores(answers) {
 const weights={};mechanisms.forEach((tag,i)=>{const s=answers?.[`mechanism_${i}`]?.score;if(typeof s!=='number'||!Number.isFinite(s)||s<0||s>3)throw new Error('Invalid Jev intent');weights[tag]=s/3;});
 return {mechanismScores:weights,schemaScores:Object.fromEntries(Object.keys(SCHEMAS).map(k=>[k,.4])),aimScores:{},actionScores:Object.fromEntries(ELIGIBLE_ACTIONS.map(a=>[a.id,Math.max(...actionContext(a).tags.map(t=>weights[t]??.15))]))};
}
export function proposeFastPlans(scores,seed,recentIds=[]) {
 const random=mulberry32(seed), chosen=[], seen=new Set(), recent=new Set(recentIds);
 // Rare kinds of act (spitting, drawing out, dismembering) outrank the common
 // ones (bringing, offering) at equal fit: weight by inverse signature frequency.
 const noveltyFit=a=>scores.actionScores[a.id]*(0.6+0.8*rarity(a))-(recent.has(a.id)?.2:0);
 // Every source operation remains reachable. Source steps are joined only for
 // their attested accompanying gestures/speech, not a fixed recipe catalogue.
 // The centre of a chain is always something done, not said, so the row is visual.
 const central=ELIGIBLE_ACTIONS.filter(a=>actionContext(a).role==='central' && a.atom.verb!=='speak');
 const best=Math.max(...central.map(noveltyFit));
 // Temperature sampling instead of a score-first sort: good fits dominate but the
 // draw varies, so repeated requests reach different acts.
 let candidates=central.filter(a=>scores.actionScores[a.id]>=.3).map(a=>({a,key:Math.pow(random(),1/Math.exp((noveltyFit(a)-best)/TEMPERATURE))})).sort((x,y)=>y.key-x.key);
 const recentMechanisms=new Map(), chainKeys=new Set();
 for(let pass=0;pass<2 && chosen.length<6;pass++)for(const {a} of candidates) {
  const source=`${a.ritualId}/${a.stepId}`,tag=actionContext(a).tags[0];
  if(seen.has(source)||(pass===0&&(recentMechanisms.get(tag)??0)>=2))continue;
  const schema=schemaFor[tag]??'petition';
  const schemaScores=Object.fromEntries(Object.keys(SCHEMAS).map(k=>[k,k===schema?1:0]));
  // Draw a length (4–9 acts) and grow toward it from the source passage; 4 is a floor, not the target.
  const target=4+Math.floor(random()*6);
  let plan;
  for(let minItems=target;minItems<=target+6;minItems+=2) {
    plan=planRitual({...scores,schemaScores,seed:(seed+chosen.length*7919)>>>0,focusActionId:a.id,maxCores:1,minItems});
    if(compileGrammarSteps({goal:'a wish',mode:'analogy',items:plan.items}).length>=4)break;
  }
  const cardsOf=compileGrammarSteps({goal:'a wish',mode:'analogy',items:plan.items});
  if(cardsOf.filter(c=>c.kind==='source').length<3||cardsOf.filter(c=>c.kind==='composed').length>2||cardsOf.length<4||plan.items.length>16||plan.leftCharged||validatePlanItems(plan.items).length)continue;
  const chainKey=plan.items.map(i=>i.atomId).join('|');if(chainKeys.has(chainKey))continue;chainKeys.add(chainKey);
  seen.add(source);recentMechanisms.set(tag,(recentMechanisms.get(tag)??0)+1);chosen.push({...plan,score:scores.actionScores[a.id]});if(chosen.length===6)break;
 }
 if(!chosen.length)throw new Error('No valid action plans');
 return {plans:chosen,mode:'analogy'};
}
export function buildFastReview(goal,proposal) {
 const plans={};const questions={};
 proposal.plans.forEach((p,i)=>{
  plans[`plan_${i}`]=compileGrammarSteps({goal,mode:'analogy',items:p.items}).map(c=>{const a=atomById.get(c.atomIds[0]);const m=actionContext(a);return {action:c.kind==='composed'?a.stepTitle:c.instruction,mechanism:m.tags[0],meaning:m.logic,purpose:m.purpose,...(a.atom.verb==='speak'?{act:a.atom.act}: {})};});
  for(const d of ['goal','coherence','grounding'])questions[`plan_${i}_${d}`]={type:'score',instructions:{question:d==='goal'?'How well does this mechanism express the wish as a modern adaptation?':d==='coherence'?'Do these actions, objects and speeches connect coherently?':'Does this modern adaptation retain the source symbolic relationships?',plan:`plan_${i}`},criteria:d==='goal'?['Unrelated to the desired change','Only generic favour, without a particular connection','Defensible symbolic connection to the desired change','Concrete and distinctive expression of the desired change']:d==='coherence'?['Contradictory objects or operations','Disconnected or repetitive operations','Mostly connected gestures and speech','Connected and economical sequence']:['Invented symbolic meaning','Major distortion of source relationships','Defensible adaptation of source logic','Source symbolic relationships retained']};
 });
 return {model:'jev-latest',state:{wish:goal,task:'Choose a modern symbolic adaptation. The chosen prayer will express the wish; historical purposes are not restrictions. Judge whether the concrete mechanism can express the desired change. Do not invent an affliction or fault.',plans},questions};
}
