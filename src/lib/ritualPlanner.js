import atomIndex from '../data/rituals/atom-index.json' with { type: 'json' };
import { SCHEMAS, GRAMMAR, VERBS, entityKey, isEntity, matchesPattern } from './ritualAtoms.js';

// A grammar-based planner. It recombines atoms from any ritual and tradition by
// the role they play in a goal structure (schema), keeping only two hard rules:
// an object must be introduced before it is used, and anything that has taken up
// the unwanted condition must leave the rite. Everything else is a preference.
export const ATOMS = atomIndex;
export const atomById = new Map(atomIndex.map((item) => [item.id, item]));
export const SCHEMA_IDS = Object.keys(SCHEMAS);
export const MAX_ITEMS = 16;
export const MIN_ITEMS = 6;
export const AIM_THRESHOLD = 0.45;
// Aims too general to mark a request as a historical match on their own.
export const GENERIC_AIMS = new Set(['avert-harm']);
const CORE_ORDER = ['stripping', 'elimination', 'return', 'healing', 'transformation', 'passage', 'protection', 'provision', 'appeasement', 'petition', 'increase', 'sign'];
const INTRODUCE = new Set(Object.entries(VERBS).filter(([, v]) => v.effect === 'introduce').map(([k]) => k));
const TRANSFORM = new Set(Object.entries(VERBS).filter(([, v]) => v.effect === 'transform').map(([k]) => k));
const CONSUME = new Set(Object.entries(VERBS).filter(([, v]) => v.effect === 'consume').map(([k]) => k));
const CHARGE = new Set(Object.entries(VERBS).filter(([, v]) => v.effect === 'charge').map(([k]) => k));
const DISPOSE_VERBS = ['release', 'burn', 'bury', 'break', 'melt', 'drive'];
const FREE_CLASSES = new Set(['person', 'deity', 'body', 'harm', 'place', 'tree', 'fire']);
// Acts never proposed for a modern recipe; they remain visible in the sources.
// Melting only suits wax or tallow; a dough or clay stand-in is burned, broken or buried instead.
const MELTABLE = (thing) => /wax|tallow|fat/.test(`${thing?.f?.material ?? ''} ${thing?.sub ?? ''} ${thing?.class ?? ''}`);
const HISTORICAL_ONLY = (atom) => atom.verb === 'kill' || (atom.verb === 'cook' && atom.theme?.class === 'meat') || atom.theme?.class === 'meat'
  || (atom.verb === 'select' && atom.theme?.class === 'person') || (atom.verb === 'dedicate' && atom.theme?.class === 'animal');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pick(random, candidates) {
  const total = candidates.reduce((sum, c) => sum + c.w, 0);
  if (!total) return null;
  let draw = random() * total;
  for (const c of candidates) { draw -= c.w; if (draw <= 0) return c; }
  return candidates.at(-1);
}

// Entities an atom needs already present (before its own effect applies).
function needs(atom) {
  if (atom.verb === 'speak' || INTRODUCE.has(atom.verb)) return [];
  const out = [];
  if (isEntity(atom.theme) && !FREE_CLASSES.has(atom.theme.class) && !(atom.verb === 'burn' && atom.theme.class === 'fire')) out.push(atom.theme);
  for (const role of ['onto', 'with', 'for']) if (isEntity(atom[role]) && !FREE_CLASSES.has(atom[role].class)) out.push(atom[role]);
  return out;
}
function produces(atom) {
  if (INTRODUCE.has(atom.verb) && isEntity(atom.theme)) return [atom.theme];
  if (TRANSFORM.has(atom.verb)) return [isEntity(atom.result) ? atom.result : null, atom.theme].filter(isEntity);
  if (atom.verb === 'exchange' && isEntity(atom.for)) return [atom.for];
  return [];
}
const sameThing = (a, b) => a && b && a.class === b.class && (!a.sub || !b.sub || a.sub === b.sub);

function adaptForModern(entity) {
  if (entity?.class === 'animal' || entity?.class === 'bird') return { class: 'figure', sub: entity.sub, f: { material: 'dough', ...(entity.f?.color ? { color: entity.f.color } : {}) }, label: `a dough figure of a ${entity.f?.color ? `${entity.f.color} ` : ''}${entity.sub ?? entity.class}` };
  return null;
}

export function planRitual({ schemaScores, aimScores = {}, seed = 1, mode = 'analogy', maxCores = 3, exclude = [] }) {
  const random = mulberry32(seed);
  // Composed recipes are always instructions for a modern person: stand-in
  // figures for animals, no killing, nothing to ingest. A historical aim only
  // pulls the draw toward the rituals that had that aim.
  const modern = true;
  const pool = ATOMS.filter((item) => !exclude.includes(item.id) && !(modern && HISTORICAL_ONLY(item.atom)));
  const relevance = ritualRelevance(aimScores);
  const ranked = SCHEMA_IDS.map((id) => ({ id, p: schemaScores[id] ?? 0 })).sort((a, b) => b.p - a.p);
  // Several cores are welcome: every schema that clearly fits, up to maxCores.
  const cores = ranked.filter((s, i) => i === 0 || (s.p >= 0.5 && s.p >= ranked[0].p - 0.35)).slice(0, maxCores);
  cores.sort((a, b) => CORE_ORDER.indexOf(a.id) - CORE_ORDER.indexOf(b.id));

  const items = [];
  const used = new Set();
  const present = []; // entities available so far
  const charged = []; // entities that took up the condition
  const unmet = [];

  const kindKey = (c) => `${c.signature}|${c.atom.theme?.sub ?? ''}|${c.atom.medium ?? ''}`;
  const repeats = (c) => items.some((i) => kindKey(atomById.get(i.atomId)) === kindKey(c));
  function weight(item, ctx) {
    let w = 1;
    if (ctx.anchor && item.ritualId === ctx.anchor) w += 2.2;
    if (ctx.last && item.ritualId === ctx.last.ritualId && item.stepNumber >= ctx.last.stepNumber) w += 1.2;
    // Acts from rituals that were performed for the requested aim are strongly preferred.
    if (relevance[item.ritualId]) w += 8 * relevance[item.ritualId];
    if (item.atom.verb === 'speak' && isEntity(item.atom.addressee) && item.atom.addressee.class === 'deity') w += 0.4;
    return w;
  }
  // A later act on "the carrier" is re-aimed at the carrier this plan chose,
  // even when its source used a different animal, figure or vessel.
  const CARRIERISH = new Set(['animal', 'bird', 'figure', 'dough', 'clay', 'vessel', 'materials', 'garment', 'wool', 'earth', 'implement', 'ornament']);
  function substitutionFor(item, bound, loose = false, roles = ['theme', 'about', 'onto', 'over']) {
    if (!bound) return null;
    for (const value of roles.map((role) => item.atom[role])) {
      if (!isEntity(value) || (!CARRIERISH.has(value.class) && value.class !== bound.class)) continue;
      if (value.class === bound.class && (value.sub ?? null) === (bound.sub ?? null)) return null;
      if (value.class === bound.class || (loose && CARRIERISH.has(bound.class) && (value !== item.atom.onto || roles.length === 1))) return { from: entityKey(value), to: bound };
    }
    return null;
  }
  function add(item, extra) {
    used.add(item.id);
    const entry = { atomId: item.id, ...extra };
    const atom = item.atom;
    // Derived lifecycle: satisfy what this atom needs from its own ritual first.
    if (extra.depth == null || extra.depth < 3) {
      for (const need of needs(atom)) {
        const target = extra.substitute?.to && entityKey(need) === extra.substitute.from ? extra.substitute.to : need;
        if (present.some((have) => sameThing(have, target) || sameThing(have, need))) continue;
        // Prefer the closest match in features, then the latest earlier act.
        const closeness = (c) => Math.max(...produces(c.atom).filter((p) => sameThing(p, need)).map((p) => (p.sub && p.sub === need.sub ? 2 : 0) + (JSON.stringify(p.f ?? {}) === JSON.stringify(need.f ?? {}) ? 1 : 0)));
        const source = pool.filter((c) => !used.has(c.id) && c.ritualId === item.ritualId
          && (c.stepNumber < item.stepNumber || (c.stepNumber === item.stepNumber && c.atomIndex < item.atomIndex))
          && produces(c.atom).some((p) => sameThing(p, need)))
          .map((c) => ({ c, k: closeness(c) })).sort((a, b) => b.k - a.k || b.c.stepNumber - a.c.stepNumber || b.c.atomIndex - a.c.atomIndex)[0]?.c;
        const passOn = extra.substitute?.to && produces(source?.atom ?? {}).some((p) => entityKey(p) === extra.substitute.from);
        if (source) {
          // An unspecific need ("the black garments") takes everything that step introduced of that kind.
          const siblings = need.sub ? [] : pool.filter((c) => c !== source && !used.has(c.id) && c.ritualId === source.ritualId && c.stepId === source.stepId && produces(c.atom).some((p) => sameThing(p, need)));
          for (const sibling of [...siblings, source].sort((a, b) => a.atomIndex - b.atomIndex)) add(sibling, { schema: extra.schema, slot: extra.slot, reason: 'requires', depth: (extra.depth ?? 0) + 1, ...(passOn ? { substitute: extra.substitute } : {}) });
        }
        else { entry.gather = [...(entry.gather ?? []), target]; unmet.push(target); present.push(target); }
      }
    }
    for (const p of produces(atom)) present.push(extra.substitute?.to && entityKey(p) === extra.substitute.from ? extra.substitute.to : p);
    const chargedThing = CHARGE.has(atom.verb) ? atom.theme : (atom.verb === 'speak' && ['substitution', 'assignment'].includes(atom.act) && extra.schema === 'elimination') ? atom.about : null;
    if (isEntity(chargedThing) && !['person', 'harm', 'deity'].includes(chargedThing.class)) charged.push(extra.substitute?.to && entityKey(chargedThing) === extra.substitute.from ? extra.substitute.to : chargedThing);
    if (CONSUME.has(atom.verb) || atom.verb === 'drive') {
      const gone = extra.substitute?.to && entityKey(atom.theme) === extra.substitute.from ? extra.substitute.to : atom.theme;
      for (let i = charged.length - 1; i >= 0; i--) if (sameThing(charged[i], gone)) charged.splice(i, 1);
    }
    items.push(entry);
    return entry;
  }

  function fillSchema(schemaId, p) {
    const schema = SCHEMAS[schemaId];
    const bound = {};
    let anchor = null, last = null;
    for (const slot of schema.slots) {
      if (slot.optional && random() > 0.65) continue;
      const lastTwo = items.slice(-2).map((i) => atomById.get(i.atomId).atom.verb);
      if (slot.optional && lastTwo.length === 2 && lastTwo.every((v) => v === 'speak') && slot.match.every((m) => m.verb?.includes('speak'))) continue;
      const candidates = pool.filter((c) => !used.has(c.id) && !repeats(c) && slot.match.some((m) => matchesPattern(c.atom, m, bound))
        && !(c.atom.verb === 'melt' && Object.values(bound).some(Boolean) && !Object.values(bound).some(MELTABLE))
        && !(slot.notSameAs && bound[slot.notSameAs] && isEntity(c.atom.theme) && c.atom.theme.class === bound[slot.notSameAs].class && (c.atom.theme.sub ?? '') === (bound[slot.notSameAs].sub ?? '')))
        .map((c) => ({ c, w: weight(c, { anchor, last }) + (slot.prefer?.includes(c.atom.theme?.class) ? 3 : 0) }));
      const chosen = pick(random, candidates);
      if (!chosen) continue;
      const item = chosen.c;
      let substitute = null;
      if (slot.binds) {
        const value = item.atom.verb === 'shape' && isEntity(item.atom.result) ? item.atom.result : item.atom.theme;
        bound[slot.binds] = isEntity(value) ? value : null;
        if (modern && bound[slot.binds]) {
          const figure = adaptForModern(bound[slot.binds]);
          if (figure) { substitute = { from: entityKey(bound[slot.binds]), to: figure }; bound[slot.binds] = figure; }
        }
        anchor = item.ritualId;
      } else {
        const onName = slot.on ?? slot.match.find((m) => m.on)?.on;
        const target = onName ? bound[onName] : (bound.carrier ?? bound.figure ?? Object.values(bound).find(Boolean));
        if (item.atom.verb === 'pass' && bound.threshold && item.ritualId !== anchor) substitute = { boundary: bound.threshold };
        else if (onName || ['elimination', 'return', 'stripping'].includes(schemaId)) substitute = substitutionFor(item, target, ['elimination', 'return', 'stripping'].includes(schemaId), slot.match.find((m) => matchesPattern(item.atom, m, bound))?.onRole);
        if (!substitute && modern) {
          const live = [item.atom.theme, item.atom.about, item.atom.over].find((v) => isEntity(v) && (v.class === 'animal' || v.class === 'bird'));
          if (live) substitute = { from: entityKey(live), to: adaptForModern(live) };
        }
      }
      anchor ??= item.ritualId;
      add(item, { schema: schemaId, slot: slot.id, role: slot.role, reason: 'slot', ...(substitute ? { substitute } : {}) });
      last = item;
    }
    return p;
  }

  // Opening: a cleansing or invocation, preferably from the first core's ritual.
  const opener = () => {
    const coreVerbs = new Set(cores.flatMap((core) => SCHEMAS[core.id].slots.flatMap((slot) => slot.match.flatMap((m) => m.verb ?? []))));
    const candidates = pool.filter((c) => !used.has(c.id) && GRAMMAR.arc.opening.some((m) => matchesPattern(c.atom, m)) && !(c.atom.verb === 'wash' && coreVerbs.has('wash'))).map((c) => ({ c, w: 1 }));
    const chosen = pick(random, candidates);
    if (chosen) add(chosen.c, { schema: 'arc', slot: 'opening', role: 'opening', reason: 'arc' });
  };
  if (random() < 0.7) opener();
  for (const core of cores) fillSchema(core.id, core.p);
  // A rite of two or three acts is thin: add the next plausible structures until it has substance.
  for (const next of ranked.filter((s) => !cores.some((c) => c.id === s.id) && s.p >= 0.2)) {
    if (items.length >= MIN_ITEMS || cores.length >= maxCores + 1) break;
    cores.push(next);
    fillSchema(next.id, next.p);
  }
  // Anything still carrying the condition must leave: dispose of it.
  for (const thing of [...charged]) {
    const candidates = pool.filter((c) => !used.has(c.id) && DISPOSE_VERBS.includes(c.atom.verb) && isEntity(c.atom.theme) && (c.atom.verb !== 'melt' || MELTABLE(thing))
      && (c.atom.theme.class === thing.class || (thing.class === 'figure' && ['figure', 'clay', 'dough', 'animal'].includes(c.atom.theme.class))))
      .map((c) => ({ c, w: 1 + (c.atom.verb === 'release' ? 0.5 : 0) }));
    const chosen = pick(random, candidates);
    if (chosen) add(chosen.c, { schema: 'arc', slot: 'dispose', role: 'close', reason: 'dispose', substitute: { from: entityKey(chosen.c.atom.theme), to: thing } });
  }
  if (random() < 0.8) {
    const recentActs = new Set(items.slice(-3).map((i) => atomById.get(i.atomId).atom.act).filter(Boolean));
    const candidates = pool.filter((c) => !used.has(c.id) && GRAMMAR.arc.closing.some((m) => matchesPattern(c.atom, m)) && !recentActs.has(c.atom.act)).map((c) => ({ c, w: 1 }));
    const chosen = pick(random, candidates);
    if (chosen) add(chosen.c, { schema: 'arc', slot: 'closing', role: 'closing', reason: 'arc' });
  }
  // Keep the rite to a performable length: drop the weakest core and redraw.
  if (items.length > 13 && maxCores > 1 && cores.length > 1) return planRitual({ schemaScores, aimScores, seed, mode, maxCores: Math.min(maxCores, cores.length) - 1, exclude });
  const trimmed = items.slice(0, MAX_ITEMS).map(({ depth, ...item }) => item);
  return { seed, mode, cores, items: trimmed, unmet: unmet.length, leftCharged: charged.length };
}

export function scorePlan(plan, schemaScores) {
  const byCore = new Map(plan.cores.map((c) => [c.id, c.p]));
  let coverage = 0;
  for (const [id, p] of byCore) {
    const required = SCHEMAS[id].slots.filter((s) => !s.optional).map((s) => s.id);
    const filled = new Set(plan.items.filter((i) => i.schema === id).map((i) => i.slot));
    coverage += p * (required.filter((s) => filled.has(s)).length / required.length);
  }
  let joins = 0;
  for (let i = 1; i < plan.items.length; i++) {
    const a = atomById.get(plan.items[i - 1].atomId), b = atomById.get(plan.items[i].atomId);
    if (a.ritualId === b.ritualId && b.stepNumber >= a.stepNumber) joins++;
  }
  const coherence = plan.items.length > 1 ? joins / (plan.items.length - 1) : 0;
  const n = plan.items.length;
  return coverage + 0.35 * coherence - 0.06 * Math.max(0, n - 13) - 0.12 * Math.max(0, 5 - n) - 0.15 * plan.unmet - 0.4 * plan.leftCharged;
}

// Sample many recombinations and keep the best distinct ones.
// Which structures a ritual itself realises: the share of a schema's required
// slots that the ritual's own atoms can fill.
const ritualSchemaFit = new Map();
export function schemaFitOf(ritualId) {
  if (ritualSchemaFit.has(ritualId)) return ritualSchemaFit.get(ritualId);
  const own = ATOMS.filter((a) => a.ritualId === ritualId && !HISTORICAL_ONLY(a.atom));
  const fit = Object.fromEntries(SCHEMA_IDS.map((id) => {
    const required = SCHEMAS[id].slots.filter((slot) => !slot.optional);
    const filled = required.filter((slot) => own.some((a) => slot.match.some((m) => matchesPattern(a.atom, { ...m, on: undefined }))));
    return [id, filled.length / required.length];
  }));
  ritualSchemaFit.set(ritualId, fit);
  return fit;
}
// How strongly each ritual answers the requested aims: the aim's probability times
// the share of the ritual's steps that serve that aim. Paškuwatti serves procreative
// power throughout; Tunnawiya asks for descendants only in its closing steps.
export function ritualRelevance(aimScores = {}) {
  const out = {};
  const steps = new Map();
  for (const a of ATOMS) steps.set(`${a.ritualId}/${a.stepId}`, a);
  const byRitual = new Map();
  for (const step of steps.values()) byRitual.set(step.ritualId, [...(byRitual.get(step.ritualId) ?? []), step]);
  for (const [ritualId, list] of byRitual) {
    let best = 0;
    for (const [aim, p] of Object.entries(aimScores)) {
      if (p < AIM_THRESHOLD || GENERIC_AIMS.has(aim)) continue;
      best = Math.max(best, p * (list.filter((step) => step.aims.includes(aim)).length / list.length));
    }
    if (best > 0.15) out[ritualId] = best;
  }
  return out;
}
// A relevant ritual lends its own shape to the reading of the goal, so "more
// procreative power" brings Paškuwatti's gate, exchange and petition.
export function aimInformedScores(schemaScores, aimScores = {}) {
  const out = { ...schemaScores };
  for (const [ritualId, r] of Object.entries(ritualRelevance(aimScores))) {
    for (const [id, fit] of Object.entries(schemaFitOf(ritualId))) if (fit >= 0.99) out[id] = Math.max(out[id] ?? 0, Math.min(0.85, r * 0.95));
  }
  return out;
}

export function proposeRituals({ schemaScores: rawScores, aimScores = {}, seed = Date.now() % 2 ** 31, mode, samples = 40, keep = 4 }) {
  const schemaScores = aimInformedScores(rawScores, aimScores);
  const historical = mode ?? (Object.entries(aimScores).some(([id, p]) => p >= 0.75 && !GENERIC_AIMS.has(id)) ? 'historical' : 'analogy');
  const plans = [];
  for (let i = 0; i < samples; i++) {
    const plan = planRitual({ schemaScores, aimScores, seed: (seed + i * 7919) >>> 0, mode: historical });
    plans.push({ ...plan, score: scorePlan(plan, schemaScores) });
  }
  plans.sort((a, b) => b.score - a.score);
  // When one ritual clearly answers the request, lead with that ritual itself,
  // in tablet order and with the modern safeguards; recombinations follow.
  const [top] = Object.entries(ritualRelevance(aimScores)).sort((a, b) => b[1] - a[1]);
  if (top && top[1] >= 0.5) {
    const own = ATOMS.filter((a) => a.ritualId === top[0] && !HISTORICAL_ONLY(a.atom));
    const items = own.slice(0, 24).map((a) => {
      const live = [a.atom.theme, a.atom.about, a.atom.over].find((v) => isEntity(v) && (v.class === 'animal' || v.class === 'bird'));
      return { atomId: a.id, schema: 'arc', slot: 'attested', role: 'core', reason: 'slot', ...(live ? { substitute: { from: entityKey(live), to: adaptForModern(live) } } : {}) };
    });
    if (items.length >= 3) plans.unshift({ seed, mode: historical, cores: [], items, unmet: 0, leftCharged: 0, score: 10, attested: top[0] });
  }
  const distinct = [];
  for (const plan of plans) {
    const key = plan.items.map((i) => i.atomId).sort().join('|');
    if (distinct.some((d) => d.key === key)) continue;
    distinct.push({ ...plan, key });
    if (distinct.length === keep) break;
  }
  return { mode: historical, schemaScores, plans: distinct.map(({ key, ...plan }) => plan) };
}

export function validatePlanItems(items) {
  const errors = [];
  if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS + 8) return ['Invalid plan length'];
  const seen = new Set();
  for (const item of items) {
    if (!atomById.has(item.atomId)) errors.push(`Unknown atom ${item.atomId}`);
    if (seen.has(item.atomId)) errors.push(`Repeated atom ${item.atomId}`);
    seen.add(item.atomId);
    if (item.schema !== 'arc' && item.schema != null && !SCHEMAS[item.schema]) errors.push(`Unknown schema ${item.schema}`);
  }
  return errors;
}
