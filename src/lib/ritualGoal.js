// Shared, deterministic wording. No credentials or network calls belong in this module.
const methods = new Set(['template', 'luna']);
const clean = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export function normalizeGoalFrame(value) {
  if (!value || typeof value !== 'object' || !methods.has(value.method)) throw new Error('Invalid goal wording');
  const outcome = clean(value.outcome), wish = clean(value.wish);
  if (outcome.length < 2 || outcome.length > 180 || wish.length < 6 || wish.length > 240
    || !/^May\s/i.test(wish) || /[<>\u0000-\u001f]/.test(outcome + wish)) throw new Error('Invalid goal wording');
  let relationship;
  if (value.relationship != null) {
    const person = clean(value.relationship.person);
    const kind = value.relationship.kind;
    if (!person || person.length > 80 || /[<>\u0000-\u001f]/.test(person)
      || !['reconciliation', 'cooperation', 'care', 'other'].includes(kind)) throw new Error('Invalid goal relationship');
    relationship = { person, kind };
  }
  const unwanted = clean(value.unwanted);
  if (unwanted && (unwanted.length > 120 || /[<>\u0000-\u001f]/.test(unwanted))) throw new Error('Invalid goal wording');
  return { outcome, wish, method: value.method, ...(relationship ? { relationship } : {}), ...(unwanted ? { unwanted } : {}) };
}

// Deliberately narrow: compound requests, other people's agency, negation and
// uncommon sentence forms go to the optional normalizer rather than a guessed rewrite.
export function proceduralGoalFrame(goal) {
  const value = clean(goal).replace(/[.!?]+$/, '');
  const reconciliation = value.match(/^(?:how do I (?:make|get)|I want) my (mother|father|mom|dad|sister|brother|friend|partner|wife|husband) (?:to )?(?:not be (?:mad|angry) at me|stop being (?:mad|angry) at me)$/i);
  if (reconciliation) {
    const person = `your ${reconciliation[1].toLowerCase()}`;
    return normalizeGoalFrame({ outcome: `peace between you and ${person}`, wish: `May ${person} turn toward you without anger.`,
      relationship: { person, kind: 'reconciliation' }, method: 'template' });
  }
  if (/\b(?:not|never|without|unless|instead|but|and|or|don't|doesn't|can't|won't|my|our|we|they|he|she|their)\b/i.test(value)) return null;
  let match = value.match(/^I (?:want|hope|would like) to (?:get|receive|earn) ((?:an? )?(?:A|B|C|D|F)[+-]?(?: grade)? in [\p{L}\p{N} '-]+)$/iu);
  if (match) return normalizeGoalFrame({ outcome: match[1], wish: `May you receive ${match[1]}.`, method: 'template' });
  match = value.match(/^I (?:want|hope|would like) to (open|start) ((?:a|an) [\p{L}\p{N} '-]+ (?:shop|store|business|restaurant|cafe|café))$/iu);
  if (match && !/\b(?:to|that|who|which|when|if)\b/i.test(match[2])) return normalizeGoalFrame({ outcome: `the ${match[1].toLowerCase() === 'open' ? 'opening' : 'start'} of ${match[2]}`, wish: `May you ${match[1].toLowerCase()} ${match[2]}.`, method: 'template' });
  return null;
}

// Only source acts with explicitly approved substitutions get new spoken words.
// The normalizer cannot alter divine recipients, materials, actors, or step order.
export function goalWordingFor(item, frame) {
  if (!frame || (!item.episodeId && !item.grammarId)) return null;
  const wording = normalizeGoalFrame(frame);
  // The comparison is spoken by the practitioner to a deity. "You" in the
  // goal frame denotes the user, not the divine addressee of the spoken words.
  const wish = wording.wish.replace(/^May\b/i, 'may')
    .replace(/\byour\b/gi, 'the ritual patron’s').replace(/\byou\b/gi, 'the ritual patron');
  switch (item.id) {
    case 'paskuwatti/entreat-uliliyassi':
      return { instruction: `Ask Uliliyašši for ${wording.outcome}`, words: `Uliliyašši, ${wish}`, note: 'A modern adaptation of a petition that includes partnership and descendants in a rite concerning procreative capacity. This wording does not add a wish for children to the modern request.' };
    case 'tunnawiya/wish-by-tree':
      return { instruction: `Ask the Sun-god for ${wording.outcome}`, words: `As this tree bears fruit, ${wish}`, note: 'Words for the practitioner, with you as the ritual patron. A modern adaptation of the source’s comparison between a fruitful tree and hoped-for descendants.' };
    case 'tunnawiya/wish-for-offspring':
      return { instruction: `Ask the Sun-god for ${wording.outcome}`, words: `As this cow brings forth offspring, ${wish}`, note: 'Words for the practitioner, with you as the ritual patron. A modern adaptation of the source’s fertility comparison; the original request concerned descendants.' };
    default: return null;
  }
}
