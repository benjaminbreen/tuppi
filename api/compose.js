import { compileRitualSteps, EXECUTION_VERSION } from '../src/lib/ritualExecution.js';
import { buildJevRequest, composeFromAnswers } from "../server/ritualComposer.js";

import { resolveGoalWording, resolveGoalFrame, WORDING_MODEL } from "../server/ritualWording.js";
import { buildSchemaJevRequest, scoresFromJev, heuristicScores, combineScores, composeGrammar } from "../server/ritualGrammarComposer.js";
import { SCHEMA_IDS } from "../src/lib/ritualPlanner.js";

const OPENROUTER_URL = "https://openrouter.ai/api/alpha/decisions";
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const cache = new Map();
const limits = new Map();
const CACHE_MS = 10 * 60 * 1000;
const LIMIT_MS = 60 * 1000;
const LIMIT_COUNT = 8;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function tooManyRequests(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  for (const [key, value] of limits) if (now - value.start > LIMIT_MS) limits.delete(key);
  const current = limits.get(ip);
  if (!current) { limits.set(ip, { start: now, count: 1 }); return false; }
  current.count += 1;
  return current.count > LIMIT_COUNT;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "expected_json" }, 415);
    if (Number(request.headers.get("content-length") || 0) > 2048) return json({ error: "goal_too_long" }, 413);
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 2048) return json({ error: "goal_too_long" }, 413);
      body = JSON.parse(raw);
    } catch { return json({ error: "invalid_json" }, 400); }
    const goal = typeof body?.goal === "string" ? body.goal.normalize("NFKC").trim().replace(/\s+/g, " ") : "";
    if (goal.length < 3 || goal.length > 160) return json({ error: "invalid_goal" }, 400);
    const seed = Number.isInteger(body?.seed) && body.seed >= 0 && body.seed < 2 ** 31 ? body.seed : Math.floor(Math.random() * 2 ** 31);
    if (body?.engine !== "episodes") return composeWithGrammar(request, goal, seed);
    const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    const typeSafeKey = process.env.TYPESAFE_API_KEY?.trim();
    const provider = openRouterKey
      ? { name: "openrouter", url: OPENROUTER_URL, model: "~typesafe/jev-latest", key: openRouterKey }
      : typeSafeKey
        ? { name: "typesafe", url: TYPESAFE_URL, model: "jev-latest", key: typeSafeKey }
        : null;
    if (!provider) return json({ error: "jev_not_configured" }, 503);
    if (tooManyRequests(request)) return json({ error: "rate_limited" }, 429);

    const cacheKey = `${provider.name}:${process.env.OPENAI_API_KEY?.trim() ? WORDING_MODEL : "templates"}:speech-v6:${goal}`;
    const saved = cache.get(cacheKey);
    if (saved && Date.now() - saved.time < CACHE_MS) {
      const composed = composeFromAnswers(saved.answers, null, Math.random);
      const value = { ...saved.value, ...composed };
      value.planning.status = "cached-judgments";
      value.executionSteps = compileRitualSteps(value);
      return json(value);
    }
    try {
      const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
      const jevRequest = buildJevRequest(goal);
      jevRequest.model = provider.model;
      const upstream = await fetch(provider.url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(jevRequest),
        signal: deadline,
      });
      if (!upstream.ok) {
        if (upstream.status === 401 || upstream.status === 403) return json({ error: "jev_auth_failed" }, 502);
        if (upstream.status === 429) return json({ error: "jev_rate_limited" }, 503);
        return json({ error: "jev_unavailable" }, 502);
      }
      const data = await upstream.json();
      const composed = composeFromAnswers(data.answers, null, Math.random);
      composed.planning.status = "single-pass";
      const wording = composed.mode === "analogy"
        ? await resolveGoalWording(goal, { signal: deadline })
        : { goalFrame: null, wording: { status: "not-needed" } };
      const value = { goal, model: data.model, ...composed, ...wording, executionVersion: EXECUTION_VERSION };
      value.executionSteps = compileRitualSteps(value);
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      if (wording.wording.status !== "unavailable") cache.set(cacheKey, { time: Date.now(), value, answers: data.answers });
      return json(value);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid Jev answer")) return json({ error: "jev_invalid_response" }, 502);
      return json({ error: "jev_unavailable" }, 502);
    }
  },
};

function jevProvider() {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const typeSafeKey = process.env.TYPESAFE_API_KEY?.trim();
  return openRouterKey ? { name: "openrouter", url: OPENROUTER_URL, model: "~typesafe/jev-latest", key: openRouterKey }
    : typeSafeKey ? { name: "typesafe", url: TYPESAFE_URL, model: "jev-latest", key: typeSafeKey } : null;
}

// Grammar engine: Jev judges goal structures and historical aims (one fixed,
// small request); Luna normalizes wording and names the unwanted condition, in
// parallel. With neither configured, a labelled offline estimate still composes.
async function composeWithGrammar(request, goal, seed) {
  if (tooManyRequests(request)) return json({ error: "rate_limited" }, 429);
  const provider = jevProvider();
  const cacheKey = `grammar:${provider?.name ?? "none"}:${process.env.OPENAI_API_KEY?.trim() ? WORDING_MODEL : "templates"}:${goal}`;
  const saved = cache.get(cacheKey);
  if (saved && Date.now() - saved.time < CACHE_MS) {
    return json({ ...composeGrammar({ goal, scores: saved.scores, goalFrame: saved.goalFrame, seed, scoring: saved.scoring }), wording: saved.wording, cached: true });
  }
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
  const jev = provider ? (async () => {
    const jevRequest = buildSchemaJevRequest(goal);
    jevRequest.model = provider.model;
    const upstream = await fetch(provider.url, { method: "POST", headers: { "Authorization": `Bearer ${provider.key}`, "Content-Type": "application/json" }, body: JSON.stringify(jevRequest), signal: deadline });
    if (!upstream.ok) throw new Error(upstream.status === 401 || upstream.status === 403 ? "jev_auth_failed" : upstream.status === 429 ? "jev_rate_limited" : "jev_unavailable");
    const data = await upstream.json();
    return { scores: scoresFromJev(data.answers), model: data.model };
  })() : Promise.resolve(null);
  const [jevResult, frameResult] = await Promise.allSettled([jev, resolveGoalFrame(goal, SCHEMA_IDS, { signal: deadline })]);
  const frame = frameResult.status === "fulfilled" ? frameResult.value : { goalFrame: null, structures: [], wording: { status: "unavailable" } };
  let scores, scoring;
  if (jevResult.status === "fulfilled" && jevResult.value) { scores = combineScores(jevResult.value.scores, frame.structures); scoring = "jev"; }
  else if (frame.structures.length) { scores = combineScores(heuristicScores(goal), frame.structures, { floor: true }); scoring = "luna"; }
  else { scores = heuristicScores(goal); scoring = "offline"; }
  const jevError = jevResult.status === "rejected" ? (jevResult.reason?.message?.startsWith("Invalid Jev answer") ? "jev_invalid_response" : jevResult.reason?.message ?? "jev_unavailable") : null;
  try {
    const value = composeGrammar({ goal, scores, goalFrame: frame.goalFrame, seed, scoring });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    if (scoring === "jev") cache.set(cacheKey, { time: Date.now(), scores, goalFrame: frame.goalFrame, scoring, wording: frame.wording });
    return json({ ...value, model: jevResult.value?.model ?? null, wording: frame.wording, ...(jevError ? { jevError } : {}) });
  } catch {
    return json({ error: "compose_failed" }, 502);
  }
}
