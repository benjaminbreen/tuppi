import { ATOMS, atomById, HISTORICAL_ONLY, proposeRituals, planRitual, scorePlan, mulberry32, validatePlanItems } from '../src/lib/ritualPlanner.js';
import { compileGrammarSteps, describePlan, GRAMMAR_EXECUTION_VERSION } from '../src/lib/ritualGrammarCards.js';
import { SCHEMAS, realizeAtom } from '../src/lib/ritualAtoms.js';
import { scoresFromJev, guardScores } from './ritualGrammarComposer.js';
import occurrences from '../src/data/rituals/composition-index.json' with { type: 'json' };
import { selectorMeaning } from '../src/lib/ritualActionMeaning.js';
import aims from '../src/data/rituals/ritual-aims.json' with { type: 'json' };

export const ELIGIBLE_ACTIONS = ATOMS.filter(a => !HISTORICAL_ONLY(a.atom));
const sourceById = new Map(occurrences.map(s => [`${s.ritualId}/${s.stepId}`, s]));
export function actionContext(action) { return selectorMeaning(action); }
// Independent questions must carry their own candidate meaning.
export function splitActionRequest(request, budget = 95000) {
 const chunks=[];let questions={},size=JSON.stringify(request.state).length;
 for(const [id,q] of Object.entries(request.questions)) {
  const length=JSON.stringify(q).length+id.length;
  if(size+length>budget && Object.keys(questions).length) {chunks.push({...request,questions});questions={};size=JSON.stringify(request.state).length;}
  questions[id]=q;size+=length;
 }
 if(Object.keys(questions).length) chunks.push({...request,questions});
 return chunks;
}
export function buildActionRequest(goal) {
  const questions = {};
  for (const [id, outcome] of Object.entries(aims)) questions[`aim_${id}`] = {
    type: 'noul', instructions: `Does the wish ask for this outcome directly, rather than by analogy? ${outcome}`,
  };
  for (const [id, schema] of Object.entries(SCHEMAS)) questions[`schema_${id}`] = {
    type: 'noul', instructions: `Does this pattern suit the wish? ${schema.reading}`,
  };
  ELIGIBLE_ACTIONS.forEach((a, i) => {
    questions[`action_${i}`] = { type: 'score', instructions: {
      question: 'Rate this action’s fit to the wish.',
      candidate: actionContext(a),
    }, criteria: ['Unrelated', 'General support', 'Clear analogy or relevant support', 'Distinctive central action'] };
  });
  return { model: 'jev-latest', state: {
    wish: goal,
    task: 'Match actions to the wish. Keep its subject and desired change. Do not invent an affliction. Historical purposes are context; symbolic uses may differ.',
  }, questions };
}

function score(answers, id) {
  const value = answers?.[id]?.score;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 3) throw new Error(`Invalid Jev score for ${id}`);
  return value;
}
export function actionScoresFromAnswers(answers) {
  return { ...scoresFromJev(answers), actionScores: Object.fromEntries(ELIGIBLE_ACTIONS.map((a, i) => [a.id, score(answers, `action_${i}`) / 3])) };
}
export function proposeActionPlans(scores, seed, goalFrame) {
  const guarded = guardScores(scores, goalFrame);
  const proposal = proposeRituals({ ...guarded, seed, samples: 140, keep: 24, maxCores:1 });
  // Greedy shortlist rewards different operations and evidence, after a quality floor.
  const focused = ELIGIBLE_ACTIONS.filter(a => scores.actionScores[a.id] >= .5)
    .sort((a,b) => scores.actionScores[b.id]-scores.actionScores[a.id]);
  // One focus per signature/source step, distributed across the whole library.
  const focusKeys = new Set();
  for (const a of focused) {
    const key = `${a.ritualId}/${a.stepId}/${a.signature}`;
    if (focusKeys.has(key)) continue;
    focusKeys.add(key);
    const p = planRitual({...guarded,seed,focusActionId:a.id});
    if(p.items.length <= 16 && !p.leftCharged && !validatePlanItems(p.items).length) {
      const fit = p.items.reduce((sum,i) => sum+(scores.actionScores[i.atomId]??0),0)/p.items.length;
      proposal.plans.push({...p,score:1.5*fit + .5 + .15*(p.items.some(i=>atomById.get(i.atomId).atom.verb==='speak')?1:0)});
    }
  }
  const unique = new Map();
  for(const p of proposal.plans) {
    const fit=p.items.reduce((sum,i)=>sum+(scores.actionScores[i.atomId]??0),0)/p.items.length;
    const central=p.items.filter(i=>selectorMeaning(atomById.get(i.atomId)).role==='central');
    const centralFit=central.length?central.reduce((sum,i)=>sum+(scores.actionScores[i.atomId]??0),0)/central.length:0;
    const key=p.items.map(i=>i.atomId).join('|');
    unique.set(key,{...p,score:2*centralFit+fit-.04*p.items.length-.12*(new Set(p.items.map(i=>atomById.get(i.atomId).ritualId)).size-1)});
  }
  const remaining = [...unique.values()];
  const selected = [];
  while (remaining.length && selected.length < 8) {
    const seen = new Set(selected.flatMap(p => p.items.map(i => i.atomId)));
    remaining.sort((a,b) => (b.score + .7 * b.items.filter(i => !seen.has(i.atomId)).length / b.items.length)
      - (a.score + .7 * a.items.filter(i => !seen.has(i.atomId)).length / a.items.length));
    selected.push(remaining.shift());
  }
  if (!selected.length) throw new Error('No valid action plans');
  return { ...proposal, plans: selected };
}
export function buildActionReviewRequest(goal, proposal, goalFrame) {
  const questions = {}, plans = {}, sources = {};
  proposal.plans.forEach((plan, i) => {
    const id = `plan_${i}`;
    plans[id] = compileGrammarSteps({ goal, goalFrame, mode: 'analogy', items: plan.items }).map(c => ({
      action: c.instruction, ...(c.words ? { words: c.words } : {}),
      meaning: selectorMeaning(atomById.get(c.atomIds[0])), ...(c.notes.length ? { changes: c.notes } : {}),
    }));
    for (const item of plan.items) {
      const a = atomById.get(item.atomId), step = sourceById.get(`${a.ritualId}/${a.stepId}`);
      sources[`${a.ritualId}/${a.stepId}`] = { action: a.stepTitle, meaning: step?.summary, purpose: step?.ritualPurpose };
    }
    const dimensions = {
      goal: { question: 'How well does this chain express the particular wish?', criteria: ['Unrelated', 'Generic favour only', 'Clear connection', 'Precise and distinctive connection'] },
      coherence: { question: 'Do this chain’s actions, objects, recipients and spoken words work together?', criteria: ['Contradictory', 'Disconnected or repetitive', 'Mostly connected', 'Connected and economical'] },
      grounding: { question: 'Does the adaptation retain the source actions’ relationships and symbolic logic?', criteria: ['Invented meaning', 'Major distortion', 'Defensible adaptation', 'Source logic retained'] },
    };
    for (const [dimension, rubric] of Object.entries(dimensions)) questions[`${id}_${dimension}`] = {
      type: 'score', instructions: { question: rubric.question, plan: id }, criteria: rubric.criteria,
    };
  });
  return { model: 'jev-latest', state: {
    wish: goal,
    task: 'Assess these modern adaptations. Short complete chains are welcome. Borrowing between sources is allowed when the actions still make sense together. Judge the wish as written, including hostile wishes; do not add bodily injury. Source purposes are context, not restrictions on a new symbolic use.',
    plans,
  }, questions };
}

export function selectReviewedPlans(proposal, answers, seed) {
  const ranked = proposal.plans.map((plan, i) => {
    const review = Object.fromEntries(['goal','coherence','grounding'].map(d => [d, score(answers, `plan_${i}_${d}`)]));
    return { ...plan, review, quality: .4 * review.goal + .35 * review.coherence + .25 * review.grounding };
  }).sort((a,b) => b.quality - a.quality);
  const pool = ranked.filter(p => p.review.goal >= Math.max(...ranked.map(q=>q.review.goal))-.6 && p.quality >= ranked[0].quality - .75 && p.review.coherence >= 1.5 && p.review.grounding >= 1.5);
  const eligible = pool.length ? pool : [...ranked].sort((a,b)=>b.review.goal-a.review.goal || b.quality-a.quality).slice(0,1);
  const random = mulberry32(seed);
  const weights = eligible.map(p => Math.exp((p.quality - eligible[0].quality) / .3));
  let draw = random() * weights.reduce((a,b) => a+b, 0);
  let best = eligible.at(-1);
  for(let i=0;i<eligible.length;i++) { draw -= weights[i]; if(draw <= 0) { best=eligible[i]; break; } }
  return [best, ...eligible.filter(p => p !== best)];
}
export function renderActionRecipe({ goal, scores, goalFrame, seed, plans, metrics, status = 'reviewed' }) {
  const [best,...rest] = plans;
  const annotate = items => items.map(({jevProbability, ...item}) => ({ ...item, ...(scores.actionScores[item.atomId] == null ? {} : { jevActionScore: Number((scores.actionScores[item.atomId]*3).toFixed(3)) }) }));
  const items = annotate(best.items);
  if(validatePlanItems(items).length) throw new Error('Invalid action recipe');
  const recipe = { goal, goalFrame, mode: 'analogy', items };
  return { ...recipe, engine: 'grammar', composer: 'jev-actions-v1', executionVersion: GRAMMAR_EXECUTION_VERSION,
    scoring: 'jev', fit: best.review && Math.min(...Object.values(best.review)) >= 2 ? 'clear' : 'loose', seed,
    schemaScores: scores.schemaScores, aimScores: scores.aimScores, actionScores: scores.actionScores,
    alternatives: rest.map(p => ({items: annotate(p.items), review: p.review})), cores: best.cores,
    planning: { status, review: best.review ?? null, considered: 140, shortlisted: plans.length, eligibleActions: ELIGIBLE_ACTIONS.length, ...metrics },
    reading: describePlan(recipe, SCHEMAS), executionSteps: compileGrammarSteps(recipe) };
}
