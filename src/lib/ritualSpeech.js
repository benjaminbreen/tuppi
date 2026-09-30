import { EXPRESSIONS } from './ritualExpression.js';
import patterns from '../data/rituals/speech-patterns.json' with { type: 'json' };
import { instructionFor } from './ritualSemantics.js';
import { normalizeGoalFrame } from './ritualGoal.js';
export const SPEECH_PATTERNS = patterns;
function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619) >>> 0;
  return value;
}

export function compilePatternSpeech(recipe, personalized = false, expressive = false) {
  const frame = recipe.goalFrame ? normalizeGoalFrame(recipe.goalFrame) : null;
  const candidates = recipe.items.filter(item => patterns[item.id]);
  // Only one speech carries the full wish. Supporting words have their own job.
  const central = candidates.find(item => patterns[item.id].function === 'petition')
    ?? candidates.find(item => patterns[item.id].function === 'protection')
    ?? candidates.find(item => ['vitality', 'passage'].includes(patterns[item.id].function))
    ?? (personalized ? candidates[0] : undefined);
  const used = new Set();
  const steps = [];
  for (const item of recipe.items) {
    const pattern = patterns[item.id];
    const source = { id: item.id, sourceId: item.id, kind: 'source', unitId: item.unitId, instruction: instructionFor(item, true, frame) };
    if (item.id === 'tunnawiya/wash-with-water') source.instruction = 'Wash yourself with water while the practitioner begins and speaks the cleansing words';
    if (personalized) source.instruction = source.instruction.replace(/\bthe patient's\b/gi, 'your').replace(/\bthe patient\b/gi, 'you');
    if (!pattern) { steps.push(source); continue; }
    // Limit speech cards to distinct functions. Retain source instructions for any
    // unexpanded address instead of rewriting or deleting its historical action.
    if (used.has(pattern.function)) { steps.push(source); continue; }
    used.add(pattern.function);
    if (!pattern.replaceSourceCard) steps.push(source);
    let petition = '';
    if (item.id === central?.id) {
      petition = frame?.wish ?? `Let this rite address the intention: “${recipe.goal}”.`;
      if (personalized && !expressive && frame?.relationship?.kind === 'reconciliation') {
        petition = `Let anger between you and ${frame.relationship.person} depart. ${petition}`;
      }
      if (personalized && pattern.addressee !== 'participant') {
        petition = petition.replace(/\bMay you\b/g, 'May this person').replace(/\bbetween you\b/gi, 'between this person')
          .replace(/\byour\b/gi, 'their').replace(/\byou\b/gi, 'them');
      }
      if (pattern.addressee !== 'participant') petition = petition.replace(/\byour\b/gi, 'the ritual patron’s').replace(/\byou\b/gi, 'the ritual patron');
    }
    const seed = `${recipe.goal}|${recipe.items.map(x => x.id).join('|')}|${item.id}`;
    const variant = hash(seed) % pattern.variants.length;
    let words = pattern.variants[variant].replace('{petition}', petition).trim().replace(/\s+/g, ' ');
    if (personalized && petition && !pattern.variants[variant].includes('{petition}')) words += ` ${petition}`;
    if (personalized) words = pattern.addressee === 'participant'
      ? words.replace(/\bthe ritual patron[’']s\b/gi, 'your').replace(/\bthe ritual patron\b/gi, 'you')
      : words.replace(/\bthe ritual patron[’']s\b/gi, 'their').replace(/\bthe ritual patron\b/gi, 'this person');
    if (expressive && EXPRESSIONS[item.id]) {
      const expression = EXPRESSIONS[item.id];
      const choices = petition ? expression.central : expression.support;
      // Retain the complete wish, including names, negation and agency, as a clause
      // within the action's comparison instead of appending a generic blessing.
      words = choices[variant % choices.length].replace('{wish}', petition.replace(/^May\b/, 'may'));
    }
    steps.push({ id: `composed/pattern/${item.id}`, sourceId: item.id, kind: 'composed', unitId: item.unitId,
      title: pattern.title, instruction: `Speak ${pattern.title.toLowerCase()}`, words, note: pattern.note,
      addressee: pattern.addressee, speechFunction: pattern.function, evidence: pattern.source, variant, ...(expressive ? { carriesWish: !!petition } : {}),
      ...(pattern.replaceSourceCard ? { replacesSource: true } : { accompanies: item.id }) });
  }
  if (personalized && !central && recipe.items.length) {
    const item = recipe.items[recipe.items.length - 1];
    steps.push({ id: `composed/intention/${item.id}`, sourceId: item.id, unitId: item.unitId,
      kind: 'composed', title: 'Name your wish', instruction: 'Speak your intention',
      words: frame?.wish ?? `Let this rite address the intention: “${recipe.goal}”.`,
      addressee: 'participant', speechFunction: 'petition', accompanies: item.id,
      note: 'Newly composed statement of the modern intention; not a quotation from the source.' });
  }
  return steps;
}
