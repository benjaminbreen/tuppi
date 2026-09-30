import { expandRitualPreparations } from './ritualPreparation.js';
import { compilePatternSpeech } from './ritualSpeech.js';
import { instructionFor } from './ritualSemantics.js';
import { normalizeGoalFrame } from './ritualGoal.js';
import { compileGrammarSteps } from './ritualGrammarCards.js';

// Versioned procedural additions, separate from the historical occurrence registry.
// Never create a source attestation or a Jev score for an editorial bridge.
export const EXECUTION_VERSION = 6;
export const SPEECH_RULES = {
  'tunnawiya/wash-with-water': { requires: ['practitioner-speaking'] },
  'tunnawiya/pass-through-gate': { requires: ['practitioner-speaking'], comparison: 'threshold' },
};

export function validateExecutionSteps(steps) {
  const active = new Set(), errors = [];
  for (const step of steps) {
    for (const state of step.requires ?? []) if (!active.has(state)) errors.push(`Missing ${state} before ${step.id}`);
    for (const state of step.establishes ?? []) {
      if (active.has(state)) errors.push(`Already active: ${state}`);
      active.add(state);
    }
    for (const state of step.completes ?? []) {
      if (!active.delete(state)) errors.push(`Not active: ${state}`);
    }
  }
  if (active.size) errors.push('Unfinished activity');
  return errors;
}

function compileLegacySteps(recipe) {
  const adapted = recipe.mode === 'analogy' || recipe.mode === 'custom';
  const enabled = recipe.executionVersion === 1 && adapted;
  const frame = recipe.goalFrame ? normalizeGoalFrame(recipe.goalFrame) : null;
  const wish = frame?.wish ?? `Let this rite address the stated intention: “${recipe.goal}”.`;
  const lastSpeech = enabled ? recipe.items.findLastIndex(item => SPEECH_RULES[item.id]) : -1;
  const steps = [];
  let speaking = false;
  const composed = (kind, source, instruction, words, effects = {}) => ({
    id: `composed/${kind}/${source.id}`, sourceId: source.id, kind: 'composed',
    unitId: source.unitId, instruction, words,
    note: 'Newly composed for this recipe, not a translation from the tablet.',
    ...effects,
  });
  recipe.items.forEach((item, index) => {
    const rule = enabled ? SPEECH_RULES[item.id] : null;
    if (rule && !speaking) {
      steps.push(composed('begin-speech', item, 'Have the practitioner begin the petition', wish,
        { establishes: ['practitioner-speaking'] }));
      speaking = true;
    }
    steps.push({ id: item.id, sourceId: item.id, kind: 'source', unitId: item.unitId,
      instruction: rule && item.id === 'tunnawiya/wash-with-water'
        ? 'Wash yourself with water while the practitioner continues the petition'
        : instructionFor(item, adapted, frame),
      ...(rule ? { requires: rule.requires } : {}),
    });
    if (rule?.comparison === 'threshold') {
      // These words accompany the crossing; their separate card does not imply
      // that the crossing is performed twice or that its speech follows it in time.
      steps.push(composed('threshold-words', item, 'As you pass, have the practitioner speak the comparison',
        `As you pass this threshold, ${wish.charAt(0).toLowerCase()}${wish.slice(1)}`,
        { requires: ['practitioner-speaking'], accompanies: item.id,
          ...(index === lastSpeech ? { completes: ['practitioner-speaking'] } : {}) }));
      if (index === lastSpeech) speaking = false;
    } else if (rule && index === lastSpeech) {
      steps.push(composed('end-speech', item, 'Have the practitioner conclude the petition', wish,
        { requires: ['practitioner-speaking'], completes: ['practitioner-speaking'] }));
      speaking = false;
    }
  });
  const errors = validateExecutionSteps(steps);
  if (errors.length) throw new Error(errors.join('; '));
  return steps;
}


// A speech boundary is not a new petition. Source actions may start and finish
// their own accompanying speech; only a distinct comparison needs another card.
export function compileRitualSteps(recipe) {
  if (recipe.engine === 'grammar' || recipe.executionVersion === 7) return compileGrammarSteps(recipe);
  if (recipe.executionVersion === 6 && ['analogy', 'custom'].includes(recipe.mode)) return expandRitualPreparations(compilePatternSpeech(recipe, true, true));
  if (recipe.executionVersion === 5 && ['analogy', 'custom'].includes(recipe.mode)) return compilePatternSpeech(recipe, true, true);
  if (recipe.executionVersion === 4 && ['analogy', 'custom'].includes(recipe.mode)) return compilePatternSpeech(recipe, true);
  if (recipe.executionVersion === 3 && ['analogy', 'custom'].includes(recipe.mode)) return compilePatternSpeech(recipe);
  if (recipe.executionVersion !== 2 || !['analogy', 'custom'].includes(recipe.mode)) return compileLegacySteps(recipe);
  const frame = recipe.goalFrame ? normalizeGoalFrame(recipe.goalFrame) : null;
  const hasCentralPetition = recipe.items.some(item => [
    'tunnawiya/wish-by-tree', 'tunnawiya/wish-for-offspring', 'paskuwatti/entreat-uliliyassi',
  ].includes(item.id));
  const steps = [];
  for (const item of recipe.items) {
    const step = { id: item.id, sourceId: item.id, kind: 'source', unitId: item.unitId,
      instruction: instructionFor(item, true, frame) };
    if (item.id === 'tunnawiya/wash-with-water') {
      step.instruction = 'Wash yourself with water while the practitioner begins and speaks the cleansing words';
      step.establishes = ['practitioner-speaking'];
      step.completes = ['practitioner-speaking'];
    }
    if (item.id === 'tunnawiya/pass-through-gate') {
      step.instruction = 'Pass beneath the alanza-wood gate as the practitioner begins the comparison';
      step.establishes = ['practitioner-speaking'];
    }
    steps.push(step);
    if (item.id === 'tunnawiya/pass-through-gate') {
      const wish = frame?.wish ?? `Let this rite address the stated intention: “${recipe.goal}”.`;
      steps.push({ id: `composed/threshold-words/${item.id}`, sourceId: item.id, kind: 'composed', unitId: item.unitId,
        instruction: 'As you pass, have the practitioner speak the comparison',
        words: hasCentralPetition ? 'As you cross this threshold, pass from where you have been into what lies ahead.'
          : `As you pass this threshold, ${wish.charAt(0).toLowerCase()}${wish.slice(1)}`,
        note: 'Newly composed threshold comparison, not a translation from the tablet.',
        requires: ['practitioner-speaking'], completes: ['practitioner-speaking'], accompanies: item.id });
    }
  }
  const errors = validateExecutionSteps(steps);
  if (errors.length) throw new Error(errors.join('; '));
  return steps;
}
