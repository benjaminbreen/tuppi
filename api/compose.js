import { buildJevRequest, composeFromAnswers } from "../server/ritualComposer.js";

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
    const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    const typeSafeKey = process.env.TYPESAFE_API_KEY?.trim();
    const provider = openRouterKey
      ? { name: "openrouter", url: OPENROUTER_URL, model: "~typesafe/jev-latest", key: openRouterKey }
      : typeSafeKey
        ? { name: "typesafe", url: TYPESAFE_URL, model: "jev-latest", key: typeSafeKey }
        : null;
    if (!provider) return json({ error: "jev_not_configured" }, 503);
    if (tooManyRequests(request)) return json({ error: "rate_limited" }, 429);

    const cacheKey = `${provider.name}:${goal.toLocaleLowerCase()}`;
    const saved = cache.get(cacheKey);
    if (saved && Date.now() - saved.time < CACHE_MS) return json(saved.value);
    try {
      const jevRequest = buildJevRequest(goal);
      jevRequest.model = provider.model;
      const upstream = await fetch(provider.url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(jevRequest),
        signal: AbortSignal.timeout(45_000),
      });
      if (!upstream.ok) {
        if (upstream.status === 401 || upstream.status === 403) return json({ error: "jev_auth_failed" }, 502);
        if (upstream.status === 429) return json({ error: "jev_rate_limited" }, 503);
        return json({ error: "jev_unavailable" }, 502);
      }
      const data = await upstream.json();
      const composed = composeFromAnswers(data.answers);
      const value = { goal, model: data.model, ...composed };
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { time: Date.now(), value });
      return json(value);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid Jev answer")) return json({ error: "jev_invalid_response" }, 502);
      return json({ error: "jev_unavailable" }, 502);
    }
  },
};
