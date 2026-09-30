import { normalizeGoalFrame } from './ritualGoal.js';
import { MAX_RECIPE_STEPS, episodeById, actionChainById, validateEpisodePlan } from './ritualSemantics.js';
import compositionIndex from "../data/rituals/composition-index.json" with { type: "json" };
import shareIds from "../data/rituals/ritual-share-ids.json" with { type: "json" };

const known = new Map(compositionIndex.map((item) => [`${item.ritualId}/${item.stepId}`, item.unitId]));
// Append to this registry when publishing new steps; existing positions are permanent share-link IDs.
const ids = shareIds;
const modes = ["historical", "analogy", "preview", "custom"];
const fits = ["historical", "clear", "loose"];
const reasons = ["matched", "prerequisite", "manual"];

function normalize(recipe) {
  if (!recipe || typeof recipe !== "object") throw new Error("Invalid recipe");
  const goal = typeof recipe.goal === "string" ? recipe.goal.trim().replace(/\s+/g, " ") : "";
  if (goal.length < 3 || goal.length > 160 || !modes.includes(recipe.mode) || !fits.includes(recipe.fit)) throw new Error("Invalid recipe");
  if (!Array.isArray(recipe.items) || recipe.items.length < 1 || recipe.items.length > MAX_RECIPE_STEPS) throw new Error("Invalid recipe");
  const seenIds = new Set();
  const items = recipe.items.map((item) => {
    const unitId = known.get(item?.id);
    if (!unitId || !ids.includes(item.id) || seenIds.has(item.id) || !reasons.includes(item.reason)) throw new Error("Invalid recipe");
    seenIds.add(item.id);
    const p = item.jevProbability;
    if (p != null && (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1)) throw new Error("Invalid recipe");
    const episode = item.episodeId == null ? null : episodeById.get(item.episodeId);
    if (item.episodeId != null && (!episode || !episode.themes.includes(item.matchedTheme))) throw new Error("Invalid recipe");
    const chain = item.grammarId == null ? null : actionChainById.get(item.grammarId);
    if (item.grammarId != null && (!chain || !chain.themes.includes(item.matchedTheme) || episode)) throw new Error("Invalid recipe");
    return { id: item.id, unitId, reason: item.reason, ...(episode ? { episodeId: episode.id, matchedTheme: item.matchedTheme } : {}), ...(chain ? { grammarId: chain.id, matchedTheme: item.matchedTheme } : {}), ...(p == null ? {} : { jevProbability: Math.round(p * 1000) / 1000 }) };
  });
  if (items.some((item) => item.episodeId || item.grammarId) && validateEpisodePlan(items).length) throw new Error("Invalid recipe");
  if (recipe.executionVersion != null && ![1, 2, 3, 4, 5, 6].includes(recipe.executionVersion)) throw new Error("Invalid execution version");
  const goalFrame = recipe.goalFrame == null ? null : normalizeGoalFrame(recipe.goalFrame);
  return { goal, mode: recipe.mode, fit: recipe.fit, items, ...(recipe.executionVersion != null ? { executionVersion: recipe.executionVersion } : {}), ...(goalFrame ? { goalFrame } : {}) };
}

export function encodeRitualRecipe(recipe) {
  const clean = normalize(recipe);
  const bytes = new TextEncoder().encode(JSON.stringify([clean.executionVersion >= 4 ? 7 : 6, clean.goal, modes.indexOf(clean.mode), fits.indexOf(clean.fit), clean.items.map((item) => [ids.indexOf(item.id), reasons.indexOf(item.reason), item.jevProbability == null ? null : Math.round(item.jevProbability * 1000), item.episodeId ?? null, item.matchedTheme ?? null, item.grammarId ?? null]), clean.goalFrame ? [clean.goalFrame.outcome, clean.goalFrame.wish, clean.goalFrame.method, ...(clean.executionVersion >= 4 ? [clean.goalFrame.relationship ?? null] : [])] : null, clean.executionVersion ?? null]));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRitualRecipe(token) {
  if (typeof token !== "string" || token.length < 12 || token.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("Invalid recipe link");
  let payload;
  try {
    const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { throw new Error("Invalid recipe link"); }
  if (!Array.isArray(payload) || payload.length !== (payload[0] >= 6 ? 7 : payload[0] === 5 ? 6 : 5) || ![2, 3, 4, 5, 6, 7].includes(payload[0]) || !Array.isArray(payload[4])) throw new Error("Invalid recipe link");
  if (!Number.isInteger(payload[2]) || !Number.isInteger(payload[3])) throw new Error("Invalid recipe link");
  let goalFrame;
  if (payload[0] >= 5 && payload[5] !== null) {
    if (!Array.isArray(payload[5]) || payload[5].length !== (payload[0] === 7 ? 4 : 3)) throw new Error("Invalid recipe link");
    goalFrame = normalizeGoalFrame({ outcome: payload[5][0], wish: payload[5][1], method: payload[5][2], relationship: payload[0] === 7 ? payload[5][3] : undefined });
  }
  return normalize({ executionVersion: payload[0] >= 6 ? payload[6] : undefined, goalFrame, goal: payload[1], mode: modes[payload[2]], fit: fits[payload[3]], items: payload[4].map((item) => {
    if (!Array.isArray(item) || item.length !== (payload[0] === 2 ? 3 : payload[0] === 3 ? 5 : 6) || !Number.isInteger(item[0]) || !Number.isInteger(item[1]) || (item[2] !== null && (!Number.isInteger(item[2]) || item[2] < 0 || item[2] > 1000))) throw new Error("Invalid recipe link");
    return { ...(payload[0] >= 3 ? { episodeId: item[3] ?? undefined, matchedTheme: item[4] ?? undefined } : {}), ...(payload[0] >= 4 ? { grammarId: item[5] ?? undefined } : {}), id: ids[item[0]], reason: reasons[item[1]], jevProbability: item[2] === null ? undefined : item[2] / 1000 };
  }) });
}

// ---- Grammar recipes (payload version 8) ---------------------------------
// Items name atoms by their stable `ritual/step#index` id; substitutions and the
// wording frame travel with the link so opening it needs no API call.
import { atomById } from './ritualPlanner.js';
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import atomShareIds from '../data/rituals/atom-share-ids.json' with { type: 'json' };
import { SCHEMAS, isEntity } from './ritualAtoms.js';
const grammarReasons = ['slot', 'requires', 'dispose', 'arc', 'manual'];
function cleanEntity(value) {
  if (!isEntity(value)) throw new Error('Invalid recipe');
  const text = JSON.stringify(value);
  if (text.length > 400 || /[<>]/.test(text)) throw new Error('Invalid recipe');
  return value;
}
function normalizeGrammar(recipe) {
  const goal = typeof recipe?.goal === 'string' ? recipe.goal.trim().replace(/\s+/g, ' ') : '';
  if (goal.length < 3 || goal.length > 160 || !modes.includes(recipe.mode) || !fits.includes(recipe.fit)) throw new Error('Invalid recipe');
  if (!Array.isArray(recipe.items) || !recipe.items.length || recipe.items.length > 24) throw new Error('Invalid recipe');
  const seen = new Set();
  const items = recipe.items.map((item) => {
    if (!atomById.has(item?.atomId) || seen.has(item.atomId) || !grammarReasons.includes(item.reason)) throw new Error('Invalid recipe');
    if (item.schema != null && item.schema !== 'arc' && !SCHEMAS[item.schema]) throw new Error('Invalid recipe');
    seen.add(item.atomId);
    const out = { atomId: item.atomId, reason: item.reason, schema: item.schema ?? 'arc', slot: typeof item.slot === 'string' ? item.slot.slice(0, 24) : 'manual' };
    if(item.words != null) { if(typeof item.words !== 'string' || item.words.length < 3 || item.words.length > 600 || /[<>\u0000-\u001f]/.test(item.words)) throw new Error('Invalid recipe speech'); out.words=item.words; }
    if (item.substitute) out.substitute = item.substitute.boundary ? { boundary: cleanEntity(item.substitute.boundary) } : { from: String(item.substitute.from).slice(0, 80), to: cleanEntity(item.substitute.to) };
    if (Array.isArray(item.gather) && item.gather.length) out.gather = item.gather.slice(0, 4).map(cleanEntity);
    if (typeof item.jevProbability === 'number' && item.jevProbability >= 0 && item.jevProbability <= 1) out.jevProbability = Math.round(item.jevProbability * 1000) / 1000;
    return out;
  });
  const goalFrame = recipe.goalFrame == null ? null : normalizeGoalFrame(recipe.goalFrame);
  return { engine: 'grammar', executionVersion: 7, goal, mode: recipe.mode, fit: recipe.fit, items, ...(goalFrame ? { goalFrame } : {}) };
}
// Payload version 9: atoms by position in the append-only atom-share-ids list,
// schemas by index, then raw-deflated. Links stay short enough for messaging
// apps to recognise as one URL (v8 links ran past 1,400 characters). Tokens
// start with "z"; v8 and older tokens are base64 JSON starting with "W".
const schemaNames = ['arc', ...Object.keys(SCHEMAS)];
const shareIndex = new Map(atomShareIds.map((id, i) => [id, i]));
const toB64 = (bytes) => { let b = ''; for (const x of bytes) b += String.fromCharCode(x); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const trimNulls = (list) => { while (list.length && (list.at(-1) === null || list.at(-1) === undefined)) list.pop(); return list; };
export function encodeGrammarRecipe(recipe) {
  const clean = normalizeGrammar(recipe);
  const f = clean.goalFrame;
  const payload = [9, clean.goal, modes.indexOf(clean.mode), fits.indexOf(clean.fit),
    clean.items.map((item) => trimNulls([shareIndex.get(item.atomId), grammarReasons.indexOf(item.reason), schemaNames.indexOf(item.schema), item.slot, item.substitute ?? null, item.gather ?? null, item.jevProbability == null ? null : Math.round(item.jevProbability * 100), item.words ?? null])),
    f ? trimNulls([f.outcome, f.wish === `May this intention be fulfilled: “${clean.goal}”.` ? 0 : f.wish, f.method, f.relationship ?? null, f.unwanted ?? null, f.prayer ?? null, f.title ?? null]) : null];
  if (payload[4].some((item) => item[0] == null)) throw new Error('Unregistered atom');
  return `z${toB64(deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }))}`;
}
function decodeCompact(token) {
  let payload;
  try { payload = JSON.parse(strFromU8(inflateSync(fromB64(token.slice(1))))); } catch { throw new Error('Invalid recipe link'); }
  if (!Array.isArray(payload) || payload[0] !== 9 || payload.length !== 6 || !Array.isArray(payload[4])) throw new Error('Invalid recipe link');
  const goal = payload[1];
  const f = payload[5];
  const goalFrame = Array.isArray(f) ? normalizeGoalFrame({ outcome: f[0], wish: f[1] === 0 ? `May this intention be fulfilled: “${goal}”.` : f[1], method: f[2], relationship: f[3] ?? undefined, unwanted: f[4] ?? undefined, prayer: f[5] ?? undefined, title: f[6] ?? undefined }) : null;
  return normalizeGrammar({ goal, mode: modes[payload[2]], fit: fits[payload[3]], goalFrame,
    items: payload[4].map((item) => {
      if (!Array.isArray(item) || item.length < 4 || !Number.isInteger(item[0])) throw new Error('Invalid recipe link');
      return { atomId: atomShareIds[item[0]], reason: grammarReasons[item[1]], schema: schemaNames[item[2]], slot: item[3], substitute: item[4] ?? undefined, gather: item[5] ?? undefined, jevProbability: item[6] == null ? undefined : item[6] / 100, words: item[7] ?? undefined };
    }) });
}
export function decodeAnyRitualRecipe(token) {
  if (typeof token !== 'string' || token.length < 12 || token.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid recipe link');
  if (token.startsWith('z')) return decodeCompact(token);
  let payload;
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch { throw new Error('Invalid recipe link'); }
  if (!Array.isArray(payload) || payload[0] !== 8) return decodeRitualRecipe(token);
  if (payload.length !== 6 || !Array.isArray(payload[4])) throw new Error('Invalid recipe link');
  const f = payload[5];
  const goalFrame = Array.isArray(f) ? normalizeGoalFrame({ outcome: f[0], wish: f[1], method: f[2], relationship: f[3] ?? undefined, unwanted: f[4] ?? undefined, prayer:f[5] ?? undefined, title:f[6] ?? undefined }) : null;
  return normalizeGrammar({ goal: payload[1], mode: modes[payload[2]], fit: fits[payload[3]], goalFrame,
    items: payload[4].map((item) => {
      if (!Array.isArray(item) || (item.length !== 6 && item.length !== 7 && item.length !== 8)) throw new Error('Invalid recipe link');
      return { atomId: item[0], reason: grammarReasons[item[1]], schema: item[2], slot: item[3], substitute: item[4] ?? undefined, gather: item[5] ?? undefined, jevProbability: item[6] ?? undefined, words:item[7] ?? undefined };
    }) });
}
