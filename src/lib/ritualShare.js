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
  if (!Array.isArray(recipe.items) || recipe.items.length < 1 || recipe.items.length > 6) throw new Error("Invalid recipe");
  const seenIds = new Set();
  const seenUnits = new Set();
  const items = recipe.items.map((item) => {
    const unitId = known.get(item?.id);
    if (!unitId || !ids.includes(item.id) || seenIds.has(item.id) || seenUnits.has(unitId) || !reasons.includes(item.reason)) throw new Error("Invalid recipe");
    seenIds.add(item.id);
    seenUnits.add(unitId);
    const p = item.jevProbability;
    if (p != null && (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1)) throw new Error("Invalid recipe");
    return { id: item.id, unitId, reason: item.reason, ...(p == null ? {} : { jevProbability: Math.round(p * 1000) / 1000 }) };
  });
  return { goal, mode: recipe.mode, fit: recipe.fit, items };
}

export function encodeRitualRecipe(recipe) {
  const clean = normalize(recipe);
  const bytes = new TextEncoder().encode(JSON.stringify([2, clean.goal, modes.indexOf(clean.mode), fits.indexOf(clean.fit), clean.items.map((item) => [ids.indexOf(item.id), reasons.indexOf(item.reason), item.jevProbability == null ? null : Math.round(item.jevProbability * 1000)])]));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRitualRecipe(token) {
  if (typeof token !== "string" || token.length < 12 || token.length > 1600 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("Invalid recipe link");
  let payload;
  try {
    const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { throw new Error("Invalid recipe link"); }
  if (!Array.isArray(payload) || payload.length !== 5 || payload[0] !== 2 || !Array.isArray(payload[4])) throw new Error("Invalid recipe link");
  if (!Number.isInteger(payload[2]) || !Number.isInteger(payload[3])) throw new Error("Invalid recipe link");
  return normalize({ goal: payload[1], mode: modes[payload[2]], fit: fits[payload[3]], items: payload[4].map((item) => {
    if (!Array.isArray(item) || item.length !== 3 || !Number.isInteger(item[0]) || !Number.isInteger(item[1]) || (item[2] !== null && (!Number.isInteger(item[2]) || item[2] < 0 || item[2] > 1000))) throw new Error("Invalid recipe link");
    return { id: ids[item[0]], reason: reasons[item[1]], jevProbability: item[2] === null ? undefined : item[2] / 1000 };
  }) });
}
