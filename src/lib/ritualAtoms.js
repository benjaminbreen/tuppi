import grammar from '../data/rituals/grammar.json' with { type: 'json' };

// Atoms decompose a source step into verb(theme, roles). They are the comparable,
// recombinable layer; the step (and its unitId) stays the source-bound evidence.
export const GRAMMAR = grammar;
export const VERBS = grammar.verbs;
export const SPEECH_ACTS = grammar.speechActs;
export const OBJECT_CLASSES = grammar.objectClasses;
export const SCHEMAS = grammar.schemas;
const ROLES = new Set(grammar.roles);
const OBJECT_KEYS = new Set(['class', 'sub', 'count', 'f', 'ref', 'label']);

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
export const isEntity = (value) => isObject(value) && typeof value.class === 'string';

function validateEntity(value, where, errors) {
  if (!OBJECT_CLASSES[value.class]) errors.push(`${where}: unknown object class ${value.class}`);
  for (const key of Object.keys(value)) if (!OBJECT_KEYS.has(key)) errors.push(`${where}: unknown object key ${key}`);
  if (value.sub != null && (typeof value.sub !== 'string' || !value.sub.trim())) errors.push(`${where}: sub must be a non-empty string`);
  if (value.count != null && !(Number.isInteger(value.count) && value.count > 0)) errors.push(`${where}: count must be a positive integer`);
  if (value.f != null && !isObject(value.f)) errors.push(`${where}: f must be an object`);
}

export function validateAtom(atom, where = 'atom') {
  const errors = [];
  if (!isObject(atom)) return [`${where}: not an object`];
  const verb = VERBS[atom.verb];
  if (!verb) errors.push(`${where}: unknown verb ${atom.verb}`);
  if (atom.verb === 'speak') {
    if (!SPEECH_ACTS[atom.act]) errors.push(`${where}: speech needs a known act, got ${atom.act}`);
  } else if (atom.act != null) errors.push(`${where}: only speak takes act`);
  if (atom.verb !== 'speak' && atom.verb !== 'gesture' && atom.verb !== 'pass' && atom.verb !== 'sleep' && !isEntity(atom.theme)) errors.push(`${where}: ${atom.verb} needs a theme object`);
  for (const [key, value] of Object.entries(atom)) {
    if (['verb', 'act', 'theme', 'note', 'quote'].includes(key)) continue;
    if (!ROLES.has(key)) { errors.push(`${where}: unknown role ${key}`); continue; }
    if (isEntity(value)) validateEntity(value, `${where}.${key}`, errors);
    else if (typeof value !== 'string' || !value.trim()) errors.push(`${where}.${key}: role must be a string or an object`);
  }
  if (isEntity(atom.theme)) validateEntity(atom.theme, `${where}.theme`, errors);
  if (atom.result != null && !isEntity(atom.result) && typeof atom.result !== 'string') errors.push(`${where}: invalid result`);
  return errors;
}

// Identity of an entity within one ritual: explicit ref, else class and subtype.
export const entityKey = (value) => isEntity(value) ? (value.ref ?? `${value.class}${value.sub ? `:${value.sub}` : ''}`) : null;
export const atomSignature = (atom) => atom.verb === 'speak' ? `speak:${atom.act}` : `${atom.verb}(${atom.theme?.class ?? ''})`;
export const atomFineSignature = (atom) => atom.verb === 'speak' ? `speak:${atom.act}` : `${atom.verb}(${atom.theme?.class ?? ''}${atom.theme?.sub ? `:${atom.theme.sub}` : ''})`;

export const CARRIER_CLASSES = new Set(['animal', 'bird', 'figure', 'dough', 'clay', 'vessel', 'materials', 'garment', 'wool', 'earth', 'implement', 'ornament']);
export function matchesPattern(atom, pattern, bound = null) {
  if (pattern.verb && !pattern.verb.includes(atom.verb)) return false;
  if (pattern.act && !pattern.act.includes(atom.act)) return false;
  if (pattern.class && !pattern.class.includes(atom.theme?.class)) return false;
  if (pattern.about && !pattern.about.includes(atom.about?.class)) return false;
  if (pattern.sub && !pattern.sub.some((word) => (atom.theme?.sub ?? '').toLowerCase().includes(word))) return false;
  if (pattern.on && bound && bound[pattern.on]) {
    const target = bound[pattern.on];
    const roles = pattern.onRole ?? ['theme', 'onto', 'on', 'over', 'from', 'about'];
    const touches = roles.map((role) => atom[role]).some((value) => isEntity(value)
      && (value.class === target.class || (pattern.loose && CARRIER_CLASSES.has(value.class) && CARRIER_CLASSES.has(target.class))));
    if (!touches) return false;
  }
  return true;
}

// ---- Realization ---------------------------------------------------------
// In an adapted recipe the person the rite is for becomes "you".
export const BENEFICIARIES = new Set(['patient', 'offerant', 'beneficiary', 'ritual patron', 'king', 'queen', 'royal couple', 'sick man', 'affected man', 'bewitched person', 'man']);
const PERSON_WORDS = { patient: 'the patient', offerant: 'the offerant', practitioner: 'the practitioner', participants: 'the participants', king: 'the king' };
export function entityLabel(value, { adapted = false, substitute = null } = {}) {
  if (typeof value === 'string') return value;
  if (!isEntity(value)) return '';
  const entity = substitute?.to && substitute.from === entityKey(value) ? substitute.to : value;
  if (entity.label) return entity.label;
  if (entity.class === 'person' && adapted && BENEFICIARIES.has(entity.sub)) return 'you';
  if (entity.class === 'person' && PERSON_WORDS[entity.sub]) return PERSON_WORDS[entity.sub];
  const features = entity.f ?? {};
  const words = [];
  if (features.colors) words.push(features.colors.join(', '));
  else if (features.color) words.push(features.color);
  if (features.material) words.push(features.material);
  if (features.adorned) words.push('adorned');
  const sub = entity.sub;
  const noun = !sub || sub.includes(entity.class) ? (sub ?? entity.class)
    : ['fat', 'meat'].includes(entity.class) && !['tallow', 'wax'].includes(sub) ? `${sub} ${entity.class}`
    : ['dough', 'clay'].includes(entity.class) ? `${entity.class} ${sub}`
    : entity.class === 'earth' ? `${sub} of earth` : sub;
  const count = entity.count && entity.count > 1 ? `${entity.count} ` : '';
  const head = entity.class === 'wool' && entity.sub == null ? 'wool' : noun;
  const plural = (word) => /(?:ox)$/.test(word) ? `${word}en` : /(?:sheep|fish|deer|wool|bread|clay|dough|flour|fodder)$/.test(word) ? word : /[^s]s$/.test(word) ? word : /(?:ss|x|ch|sh)$/.test(word) ? `${word}es` : /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;
  const body = [...words, count ? plural(head) : head].join(' ');
  const part = features.part ? `’s ${features.part}` : '';
  if (entity.class === 'deity' || /^[A-ZḪŠ]/.test(noun)) return `${noun}${part}`;
  return `${count ? count : 'the '}${body}${part}`;
}

export function realizeAtom(atom, options = {}) {
  const verb = VERBS[atom.verb];
  if (atom.verb === 'speak') {
    const to = atom.addressee ? ` to ${entityLabel(atom.addressee, options)}` : '';
    return `Speak ${({ invocation: 'an invocation', petition: 'a petition', appeasement: 'words of appeasement', confession: 'a confession', vow: 'a vow', assignment: 'an assignment', substitution: 'the substitution', dismissal: 'the dismissal', analogy: 'a comparison', declaration: 'a declaration', binding: 'a binding' })[atom.act]}${to}`;
  }
  const self = (value) => options.adapted && isEntity(value) && value.class === 'person' && BENEFICIARIES.has(value.sub);
  if (atom.verb === 'dress' && self(atom.on)) return `Put on ${entityLabel(atom.theme, options)}`;
  if (atom.verb === 'undress' && self(atom.from)) return `Take off ${entityLabel(atom.theme, options)}`;
  if (atom.verb === 'give' && self(atom.to)) return `Take up ${entityLabel(atom.theme, options)}`;
  if (atom.verb === 'drive' && self(atom.theme)) return `Go out ${typeof atom.goal === 'string' ? (/^(to|into|toward)/.test(atom.goal) ? atom.goal : `into the ${atom.goal.replace(/^the /, '')}`) : ''}`.trim();
  if (atom.verb === 'detach' && self(atom.from)) return `Hand back ${entityLabel(atom.theme, options)}`;
  if (['wash', 'anoint', 'position', 'comb'].includes(atom.verb) && self(atom.theme)) {
    const rest = realizeAtom({ ...atom, theme: { class: 'person', label: 'yourself' } }, options);
    return rest;
  }
  if (atom.verb === 'burn' && atom.theme?.class === 'fire') return atom.theme.count > 1 ? `Kindle ${atom.theme.count} fires` : 'Kindle a fire';
  if (atom.verb === 'pass') {
    const sb = options.substitute?.boundary;
    const raw = sb ? (sb.class === 'fire' ? 'between the fires' : entityLabel(sb, options)) : atom.boundary;
    const boundary = raw && !/^(the|a|an|beneath|between|through|under|over|across)\b/i.test(raw) ? `the ${raw}` : raw;
    return boundary ? `Pass ${/^(beneath|between|through|under|over|across)/.test(boundary) ? '' : 'through '}${boundary}`.replace(/\s+/g, ' ') : 'Step across the threshold';
  }
  let text = verb.template.replace(/\{(\w+)(?:: ([^}]*))?\}/g, (_, role, prefix) => {
    const value = role === 'theme' ? atom.theme : atom[role];
    if (value == null) return prefix != null ? '' : role === 'theme' ? '' : '';
    let label = entityLabel(value, options);
    if (prefix != null && !prefix.trim() && ['location', 'goal'].includes(role) && !/^(at|in|on|into|to|toward|towards|before|beside|beneath|under|over|through|from|across|between|away|out|inside|outside|near|by|onto|upon)\b/i.test(label)) label = `at ${label}`;
    if (prefix != null && typeof value === 'string' && /^(ahead|away|out|into|back|home|to |toward|towards|inside|beyond|through|across|under|beneath|before)\b/i.test(value)) return ` ${value}`;
    return prefix != null ? ` ${prefix.trim()} ${label}`.replace(/\s+/g, ' ').replace(/^ /, ' ') : label;
  });
  text = text.replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
