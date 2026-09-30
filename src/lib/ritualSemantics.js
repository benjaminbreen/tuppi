import { goalWordingFor } from './ritualGoal.js';
import episodes from '../data/rituals/composition-episodes.json' with { type: 'json' };
import themes from '../data/rituals/composition-themes.json' with { type: 'json' };
import index from '../data/rituals/composition-index.json' with { type: 'json' };
import actions from '../data/rituals/composition-actions.json' with { type: 'json' };

export const MAX_RECIPE_STEPS = 10;
export const EPISODES = episodes;
export const THEMES = themes;
export const episodeById = new Map(episodes.map((episode) => [episode.id, episode]));
const occurrenceById = new Map(index.map((step) => [`${step.ritualId}/${step.stepId}`, step]));
export const episodeStepIds = (episode) => episode.stepIds.map((id) => `${episode.ritualId}/${id}`);
export const ACTIONS = actions;

function actionChain(terminalId) {
  const collected = new Set();
  function visit(id, visiting = new Set()) {
    if (visiting.has(id) || !actions[id]) throw new Error(`Invalid action link: ${id}`);
    if (collected.has(id)) return;
    visiting.add(id);
    for (const need of actions[id].needs) visit(need, visiting);
    visiting.delete(id);
    collected.add(id);
  }
  visit(terminalId);
  const stepIds = [...collected].sort((a, b) => occurrenceById.get(a).stepNumber - occurrenceById.get(b).stepNumber);
  const first = actions[stepIds[0]];
  return { id: terminalId, stepIds, ritualId: occurrenceById.get(terminalId).ritualId,
    role: first.role, stage: first.stage, themes: first.themes, historicalOnly: !!first.historicalOnly,
    historicalLogic: stepIds.map((id) => actions[id].logic).join(' '),
    adaptation: 'Keep participants, objects and accompanying words connected as in the source.' };
}
export const ACTION_CHAINS = Object.keys(actions).filter((id) => actions[id].terminal).map(actionChain);
export const actionChainById = new Map(ACTION_CHAINS.map((chain) => [chain.id, chain]));

// These are curated, source-bound episodes, not a claim that any recombination is attested.
export function validateEpisodePlan(items) {
  const errors = [];
  const groups = [...new Set(items.map((item) => item.episodeId).filter(Boolean))];
  if (!items.length || items.length > MAX_RECIPE_STEPS) errors.push('Invalid episode plan length');
  if (new Set(items.map((item) => item.id)).size !== items.length) errors.push('Repeated occurrence');
  for (const id of groups) {
    const episode = episodeById.get(id);
    if (!episode) { errors.push(`Unknown episode: ${id}`); continue; }
    const expected = episodeStepIds(episode);
    const actual = items.filter((item) => item.episodeId === id);
    if (JSON.stringify(actual.map((item) => item.id)) !== JSON.stringify(expected)) errors.push(`Incomplete or reordered episode: ${id}`);
    const start = items.findIndex((item) => item.episodeId === id);
    if (items.slice(start, start + expected.length).some((item) => item.episodeId !== id)) errors.push(`Interrupted episode: ${id}`);
    if (episode.supports && !items.slice(0, start).some((item) => episodeById.get(item.episodeId)?.role === episode.supports)) errors.push(`Missing ${episode.supports} before ${id}`);
    for (const item of actual) {
      if (item.matchedTheme && !episode.themes.includes(item.matchedTheme)) errors.push(`Unsupported theme: ${id}`);
    }
  }
  for (const id of new Set(items.map((item) => item.grammarId).filter(Boolean))) {
    const chain = actionChainById.get(id);
    if (!chain) { errors.push(`Unknown action chain: ${id}`); continue; }
    const actual = items.filter((item) => item.grammarId === id);
    if (JSON.stringify(actual.map((item) => item.id)) !== JSON.stringify(chain.stepIds)) errors.push(`Incomplete or reordered action chain: ${id}`);
    const start = items.findIndex((item) => item.grammarId === id);
    if (items.slice(start, start + chain.stepIds.length).some((item) => item.grammarId !== id)) errors.push(`Interrupted action chain: ${id}`);
    if (actual.some((item) => item.matchedTheme && !chain.themes.includes(item.matchedTheme))) errors.push(`Unsupported action theme: ${id}`);
    const opened = new Set();
    for (const item of actual) {
      const action = actions[item.id];
      for (const resource of action?.uses ?? []) if (!opened.has(resource)) errors.push(`Unbound resource: ${item.id}/${resource}`);
      for (const resource of action?.opens ?? []) if (opened.has(resource)) errors.push(`Resource reopened: ${item.id}/${resource}`); else opened.add(resource);
      for (const resource of action?.closes ?? []) if (!opened.delete(resource)) errors.push(`Resource not available: ${item.id}/${resource}`);
    }
    if (opened.size) errors.push(`Unfinished action chain: ${id}`);
  }
  for (let i = 0; i < items.length; i++) {
    const step = occurrenceById.get(items[i].id);
    if (!step) { errors.push('Unknown occurrence'); continue; }
    for (const required of step.requires) {
      if (!items.slice(0, i).some((item) => item.id === `${step.ritualId}/${required}`)) errors.push(`Missing prerequisite for ${items[i].id}`);
    }
    if (items.slice(0, i).some((item) => {
      const before = occurrenceById.get(item.id);
      return before?.ritualId === step.ritualId && before.stepNumber > step.stepNumber;
    })) errors.push(`Source order reversed at ${items[i].id}`);
  }
  return errors;
}

export function instructionFor(item, adapted = true, goalFrame = null) {
  const personalized = adapted && goalWordingFor(item, goalFrame);
  if (personalized) return personalized.instruction;
  const step = occurrenceById.get(item.id);
  const episode = episodeById.get(item.episodeId);
  return (adapted && (episode?.instructions[step?.stepId] || (item.grammarId && actions[item.id]?.instruction))) || step?.stepTitle || '';
}

export function connectionFor(item) {
  const episode = episodeById.get(item.episodeId);
  if (item.grammarId) {
    const chain = actionChainById.get(item.grammarId);
    const next = chain?.stepIds[chain.stepIds.indexOf(item.id) + 1];
    return next ? `Next: ${actions[next].instruction}.` : 'This completes the connected action sequence.';
  }
  if (!episode) return '';
  const step = occurrenceById.get(item.id);
  const position = episode.stepIds.indexOf(step?.stepId);
  const next = episode.stepIds[position + 1];
  if (next) return `Next in this episode: ${episode.instructions[next]}. These acts stay together in their source order.`;
  return episode.supports ? 'This completes the preceding cleansing with its concluding appeal.' : 'This completes the episode; its preparations and accompanying words stay together.';
}
