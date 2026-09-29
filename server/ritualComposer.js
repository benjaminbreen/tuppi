import compositionIndex from "../src/data/rituals/composition-index.json" with { type: "json" };
import aimIndex from "../src/data/rituals/ritual-aims.json" with { type: "json" };
import functionIndex from "../src/data/rituals/ritual-functions.json" with { type: "json" };
import analogyIndex from "../src/data/rituals/ritual-analogies.json" with { type: "json" };
import quoteIndex from "../src/data/rituals/quotes.json" with { type: "json" };

const MAX_STEPS = 6;
const AIM_MATCH = 0.75;
const DIRECT_MATCH = 0.64;
const ANALOGY_MATCH = 0.60;
const MIN_CREATIVE_FIT = 0.25;

export const occurrences = compositionIndex.map((item, index) => ({
  ...item,
  id: `${item.ritualId}/${item.stepId}`,
  questionId: `step_${index}`,
}));

const byId = new Map(occurrences.map((item) => [item.id, item]));
const creativeExcluded = new Set(analogyIndex.creativeExcludedSteps);
const aims = Object.entries(aimIndex);

function excerptFor(item) {
  const quotes = quoteIndex[item.id] ?? [];
  return (quotes.find((quote) => quote.english)?.english ?? "").slice(0, 220);
}

export function buildJevRequest(goal) {
  const questions = {};
  for (const [index, [id, description]] of aims.entries()) {
    questions[`aim_${index}`] = {
      type: "noul",
      instructions: {
        question: "Does `user_goal` directly match this historical aim? Judge the intended outcome, not efficacy.",
        historical_aim: description,
      },
      criteria: {
        true: "Substantially the same outcome.",
        false: "Only metaphor, word overlap, or no connection.",
      },
    };
  }
  for (const [id, description] of Object.entries(analogyIndex.lenses)) {
    questions[`lens_${id}`] = {
      type: "noul",
      instructions: {
        question: "Is this a concrete part of what `user_goal` asks for? Interpret ordinary and unusual modern goals literally; this is a goal theme, not a claim that a ritual works.",
        goal_theme: description,
      },
      criteria: {
        true: "The goal clearly involves this theme, even if the wording differs.",
        false: "The theme is only a remote association or is absent from the goal.",
      },
    };
  }
  for (const item of occurrences) {
    questions[item.questionId] = {
      type: "noul",
      instructions: {
        question: "Could this PARTICULAR historical act serve as a distinct symbolic step toward `user_goal`, either by its documented aim or by the stated metaphorical role? For a modern goal, judge the role, not literal materials, real-world efficacy, or generic words like 'success'.",
        act: item.stepTitle,
        description: item.summary,
        original_ritual_purpose: item.ritualPurpose,
        historical_aims: item.aims.map((aim) => aimIndex[aim]),
        ritual_function: functionIndex[item.function],
        possible_metaphorical_role: analogyIndex.functions[item.function].role,
        potential_goal_themes: analogyIndex.functions[item.function].lenses.map((id) => analogyIndex.lenses[id]),
        source_excerpt: excerptFor(item),
      },
      criteria: {
        true: "The act's specific operation provides a clear and explainable symbolic role toward the goal.",
        false: "The connection requires an invented historical meaning, generic success wish, incidental material, or word overlap.",
      },
    };
  }
  return { model: "jev-latest", state: { user_goal: goal }, questions };
}

function probability(answers, id) {
  const value = answers?.[id]?.noul;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Invalid Jev answer for ${id}`);
  }
  return value;
}

function prerequisiteClosure(item, seen = new Set()) {
  if (seen.has(item.id)) return [];
  seen.add(item.id);
  const result = [];
  for (const stepId of item.requires) {
    const required = byId.get(`${item.ritualId}/${stepId}`);
    if (!required) throw new Error(`Missing prerequisite ${item.ritualId}/${stepId}`);
    result.push(...prerequisiteClosure(required, seen));
  }
  result.push(item);
  return result;
}

const stage = {
  "collect-material": 0, "construct-setting": 0, "fashion-figure": 0,
  "prepare-material": 0, "mark-subject": 1, "place-deposit": 1,
  "sleep-over-deposit": 2, "invoke-help": 2, "appease-divinity": 2,
  "return-harm": 2, "make-offering": 3, "kill-for-offering": 3,
  "cook-offering": 3, "transfer-affliction": 3, "purify-by-analogy": 4,
  "wash-clean": 4, "destroy-affliction": 4, "cross-threshold": 4,
  "remove-mark": 5, "remove-deposit": 5, "discard-carrier": 5,
  "dispatch-substitute": 5, "seek-fertility": 5, "affirm-cleansing": 6,
};

function orderSelected(selected, scoreById) {
  const entries = [...selected.values()];
  const edges = new Map(entries.map((item) => [item.id, new Set()]));
  const indegree = new Map(entries.map((item) => [item.id, 0]));
  const addEdge = (before, after) => {
    if (before === after || edges.get(before).has(after)) return;
    edges.get(before).add(after);
    indegree.set(after, indegree.get(after) + 1);
  };
  for (const item of entries) {
    for (const prerequisite of item.requires) {
      const before = `${item.ritualId}/${prerequisite}`;
      if (selected.has(before)) addEdge(before, item.id);
    }
    for (const other of entries) {
      if (item.ritualId === other.ritualId && item.stepNumber < other.stepNumber) addEdge(item.id, other.id);
    }
  }
  const result = [];
  while (result.length < entries.length) {
    const available = entries.filter((item) => !result.includes(item) && indegree.get(item.id) === 0);
    if (!available.length) throw new Error("Selected ritual steps have conflicting order constraints");
    available.sort((a, b) => (stage[a.function] ?? 3) - (stage[b.function] ?? 3)
      || (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0)
      || a.ritualId.localeCompare(b.ritualId)
      || a.stepNumber - b.stepNumber);
    const next = available[0];
    result.push(next);
    for (const after of edges.get(next.id)) indegree.set(after, indegree.get(after) - 1);
  }
  return result;
}

export function composeFromAnswers(answers) {
  const aimScores = new Map(aims.map(([id], index) => [id, probability(answers, `aim_${index}`)]));
  const lensScores = new Map(Object.keys(analogyIndex.lenses).map((id) => [id, probability(answers, `lens_${id}`)]));
  const directAims = new Set([...aimScores].filter(([, score]) => score >= AIM_MATCH).map(([id]) => id));
  const mode = directAims.size ? "historical" : "analogy";
  const scoreById = new Map();
  const jevProbabilityById = new Map();
  const lensById = new Map();
  const eligible = [];
  for (const item of occurrences) {
    const stepScore = probability(answers, item.questionId);
    jevProbabilityById.set(item.id, stepScore);
    const aimScore = Math.max(...item.aims.map((aim) => aimScores.get(aim) ?? 0));
    if (mode === "historical" && !item.aims.some((aim) => directAims.has(aim))) continue;
    const bridge = analogyIndex.functions[item.function];
    if (mode === "analogy" && (bridge.historicalOnly || creativeExcluded.has(item.id))) continue;
    const bestLens = [...bridge.lenses].sort((a, b) => lensScores.get(b) - lensScores.get(a))[0];
    lensById.set(item.id, bestLens);
    const lensScore = bestLens ? lensScores.get(bestLens) : 0;
    const score = mode === "historical" ? 0.55 * stepScore + 0.45 * aimScore : 0.72 * stepScore + 0.28 * lensScore;
    scoreById.set(item.id, score);
    if (score >= (mode === "historical" ? DIRECT_MATCH : MIN_CREATIVE_FIT)) eligible.push(item);
  }
  eligible.sort((a, b) => scoreById.get(b.id) - scoreById.get(a.id)
    || a.ritualId.localeCompare(b.ritualId) || a.stepNumber - b.stepNumber);

  const selected = new Map();
  const reasons = new Map();
  const anchorRitual = eligible[0]?.ritualId;
  const remaining = new Set(eligible);
  while (selected.size < MAX_STEPS && remaining.size) {
    const options = [...remaining].map((item) => {
      const closure = prerequisiteClosure(item).filter((part) => !selected.has(part.id));
      const occupiedUnits = new Set([...selected.values()].map((part) => part.unitId));
      const allowed = !selected.has(item.id)
        && selected.size + closure.length <= MAX_STEPS
        && !closure.some((part) => occupiedUnits.has(part.unitId))
        && new Set(closure.map((part) => part.unitId)).size === closure.length
        && (mode === "historical" || (closure.length <= 2 && !closure.some((part) => creativeExcluded.has(part.id) || analogyIndex.functions[part.function].historicalOnly)));
      const sameFunction = [...selected.values()].filter((part) => part.function === item.function).length;
      const sameRitual = [...selected.values()].filter((part) => part.ritualId === item.ritualId).length;
      const adjusted = (scoreById.get(item.id) ?? 0) + (mode === "historical" && item.ritualId === anchorRitual && selected.size ? 0.07 : 0)
        - (mode === "analogy" ? 0.12 * (closure.length - 1) + 0.09 * sameFunction + 0.035 * sameRitual : 0);
      return { item, closure, allowed, adjusted };
    }).filter((option) => option.allowed).sort((a, b) => b.adjusted - a.adjusted || (scoreById.get(b.item.id) ?? 0) - (scoreById.get(a.item.id) ?? 0));
    const chosen = options[0];
    if (!chosen) break;
    remaining.delete(chosen.item);
    for (const part of chosen.closure) {
      selected.set(part.id, part);
      reasons.set(part.id, part.id === chosen.item.id ? "matched" : "prerequisite");
    }
  }

  return {
    mode,
    items: orderSelected(selected, scoreById).map((item) => ({
      id: item.id,
      unitId: item.unitId,
      reason: reasons.get(item.id),
      jevProbability: jevProbabilityById.get(item.id),
      matchedLens: lensById.get(item.id) ?? null,
      relevance: Number((scoreById.get(item.id) ?? 0).toFixed(3)),
    })),
    fit: mode === "historical" ? "historical" : selected.size && Math.max(...[...selected.keys()].map((id) => scoreById.get(id) ?? 0)) >= ANALOGY_MATCH ? "clear" : "loose",
  };
}
