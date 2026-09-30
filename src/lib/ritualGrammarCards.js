import quotes from '../data/rituals/quotes.json' with { type: 'json' };
import compositionIndex from '../data/rituals/composition-index.json' with { type: 'json' };
import { atomById } from './ritualPlanner.js';
import { entityLabel, entityKey, isEntity, realizeAtom, SPEECH_ACTS } from './ritualAtoms.js';

// Turns a planned sequence of atoms into numbered cards. Source cards keep their
// provenance; spoken words are composed per speech act and are always labelled
// as new, with the source passage that models them.
export const GRAMMAR_EXECUTION_VERSION = 7;
const SPEECH_TITLES = {
  invocation: 'Call the power by name', petition: 'Ask for what is wanted', appeasement: 'Calm the anger', confession: 'Speak the fault aloud',
  vow: 'Promise a return', assignment: 'Hand the carrier over', substitution: 'Name the substitute', dismissal: 'Send it away',
  analogy: 'Speak the comparison', declaration: 'Declare it done', binding: 'Bind the harm', accusation: 'Lay the case before the judge',
};
const clean = (text) => text.replace(/\s+/g, ' ').replace(/\s([,.;:!?])/g, '$1').trim();
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function patronWish(frame, goal) {
  const wish = frame?.wish ?? `May this rite answer the intention: “${goal}”.`;
  let text = wish.replace(/^May\b/i, 'may').replace(/\byourself\b/gi, 'themselves').replace(/\byou\b/gi, 'this person');
  // The first possessive names the person; later ones refer back to them.
  text = /this person/.test(text) ? text.replace(/\byour\b/gi, 'their') : text.replace(/\byour\b/i, 'this person’s').replace(/\byour\b/gi, 'their');
  return text.replace(/[.!]$/, '');
}
function unwantedFor(frame) { return frame?.unwanted ? frame.unwanted.replace(/^(your|my|our)\s+/i, '').replace(/\byour\b/gi, 'this person’s') : 'what troubles this person'; }
function addresseeOf(atom, source) {
  if (isEntity(atom.addressee) && atom.addressee.class === 'deity') return atom.addressee.sub.replace(/^(A|An|The) /, (m) => m.toLowerCase());
  if (source.recipient && /god|deit|seven|šamaš|nisaba/i.test(source.recipient)) return source.recipient.replace(/^(A|An|The) /, (m) => m.toLowerCase());
  return null;
}
function comparisonImage(about, verbContext, schema) {
  const sub = (about?.sub ?? '').toLowerCase();
  const material = about?.f?.material ?? '';
  if (about?.class === 'tree') return { lead: 'As this tree is clothed in fruit', kind: 'increase' };
  if (about?.class === 'animal' && /cow|herd|ewe/.test(sub)) return { lead: 'As this cow fills her pen with young', kind: 'increase' };
  if (about?.class === 'structure' || /gate|door/.test(sub)) return { lead: 'As this gate has cleansed thousands who passed beneath it', kind: 'passage' };
  if (/wax|tallow/.test(material + sub) || verbContext === 'melt') return { lead: 'As this wax melts away', kind: 'removal', tail: 'melt away' };
  if (about?.class === 'place' || /spring|river/.test(sub)) return { lead: 'As the spring wells mud up out of the dark earth', kind: 'removal', tail: 'be drawn up and out' };
  if (about?.class === 'implement' && /bow|arrow/.test(sub)) return { lead: 'As the bow is taken up in place of the spindle', kind: 'passage' };
  if (about?.class === 'stone') return { lead: 'As the hot stone falls silent in the water', kind: 'removal', tail: 'fall silent' };
  if (about?.class === 'fire' || /smoke/.test(sub)) return { lead: 'As smoke rises and is gone', kind: 'removal', tail: 'be gone' };
  if (about?.class === 'earth' || about?.class === 'dough') return { lead: `As this ${sub || about.class} takes up what it touches`, kind: 'removal', tail: 'be taken up' };
  if (about?.class === 'bird') return { lead: 'As the bird flies off and does not come back', kind: 'removal', tail: 'fly off and not come back' };
  if (schema === 'passage') return { lead: 'As this threshold is crossed', kind: 'passage' };
  if (schema === 'transformation') return { lead: 'As the old is set down and the new taken up', kind: 'passage' };
  return { lead: 'As this is done before you', kind: 'neutral' };
}

export function speechWords(atom, context) {
  const { frame, goal, central, carrier, source } = context;
  const addr = addresseeOf(atom, source);
  const to = addr ? `${addr}, ` : '';
  const unwanted = unwantedFor(frame);
  const wish = patronWish(frame, goal);
  const person = frame?.relationship?.person;
  switch (atom.act) {
    case 'invocation': return `${to}turn toward this place and hear the one who calls you.`;
    case 'petition': return central ? `${to}${wish}.` : `${to}look kindly on this person and on what is done here.`;
    case 'appeasement': return `${to}be calm. Let anger give way; take what is offered and turn back toward peace${person ? ` between this person and ${person.replace(/^your\b/i, 'their')}` : ''}.`;
    case 'confession': return person ? `What went wrong between this person and ${person.replace(/^your\b/i, 'their')} is spoken aloud here and not hidden.` : 'What went wrong is spoken aloud here and not hidden.';
    case 'vow': return `When this is granted, it will be answered with thanks and with gifts.`;
    case 'assignment': return `${to}this ${carrier ?? 'offering'} is yours; take it for your own${central ? `, and ${wish}` : ''}.`;
    case 'substitution': return `${to}here is ${carrier ? `the ${carrier}` : 'the substitute'}, in place of this person. Let it carry ${unwanted} away.`;
    case 'dismissal': return `${capital(unwanted)}, go! Leave the limbs, the house and the road of this person, and do not return.`;
    case 'declaration': return frame?.unwanted ? `It is done: this person stands clear of ${unwanted}.` : 'It is done; what was asked has been carried out.';
    case 'binding': return `Let ${unwanted} be seized and held fast; let it not reach this person.`;
    case 'accusation': return `${to}judge this case: ${unwanted} came without right. Let it be turned back to where it came from.`;
    case 'analogy': {
      const image = comparisonImage(atom.about, context.previousVerb, context.schema);
      if (image.kind === 'removal') return `${image.lead}, so let ${unwanted} ${image.tail}.`;
      const lead = to ? `${to}${image.lead.charAt(0).toLowerCase()}${image.lead.slice(1)}` : image.lead;
      if (central) return `${lead}, so ${wish}.`;
      if (image.kind === 'increase') return `${lead}, so let good increase for this person.`;
      if (image.kind === 'passage') return `${lead}, so let this person pass into what lies ahead.`;
      return `${lead}, so let good come to this person.`;
    }
    default: return `${to}${wish}.`;
  }
}

function sourceOf(item) {
  const record = atomById.get(item.atomId);
  if (!record) throw new Error(`Unknown atom ${item.atomId}`);
  return record;
}
function evidenceFor(record) {
  const quote = quotes[`${record.ritualId}/${record.stepId}`]?.find((q) => q.english) ?? quotes[`${record.ritualId}/${record.stepId}`]?.[0];
  return quote ? { text: quote.english ?? quote.original, original: !quote.english, locus: quote.locus,
    source: { witness: quote.witness, doc: quote.doc, locus: quote.locus, anchor: quote.anchor } } : null;
}

export function compileGrammarSteps(recipe) {
  const adapted = false;
  const frame = recipe.goalFrame ?? null;
  const items = recipe.items ?? [];
  // Which speech carries the whole wish: the first petition, then analogy, in a core.
  const coreSpeech = items.map((item, i) => ({ item, i, atom: sourceOf(item).atom })).filter(({ item, atom }) => atom.verb === 'speak' && (item.schema !== 'arc' || item.slot === 'attested'));
  const central = (coreSpeech.find(({ atom }) => atom.act === 'petition') ?? coreSpeech.find(({ atom }) => atom.act === 'analogy' && comparisonImage(atom.about).kind !== 'removal')
    ?? coreSpeech.find(({ atom }) => ['assignment', 'declaration'].includes(atom.act)))?.i ?? -1;
  const cards = [];
  let previousRitual = null, carrier = null, previousVerb = null, carrierUnitId = null;
  items.forEach((item, index) => {
    const record = sourceOf(item);
    const atom = record.atom;
    const sub = item.substitute?.to ? item.substitute : null;
    if (item.slot === 'carrier' || item.slot === 'figure' || item.slot === 'gather') {
      const bound = sub?.to ?? (atom.verb === 'shape' && isEntity(atom.result) ? atom.result : atom.theme);
      carrier = isEntity(bound) ? entityLabel(bound, { adapted }).replace(/^(the|a|an) /, '') : carrier;
      carrierUnitId = record.unitId;
    }
    const seam = previousRitual && previousRitual.ritualId !== record.ritualId
      ? { from: previousRitual.ritualName, to: record.ritualName, acrossTraditions: previousRitual.corpusId !== record.corpusId } : null;
    const provenance = { ritualId: record.ritualId, ritualName: record.ritualName, sourceLabel: record.sourceLabel, corpusId: record.corpusId,
      region: record.region, stepId: record.stepId, stepNumber: record.stepNumber, stepTitle: record.stepTitle };
    const notes = [];
    const original = [atom.theme, atom.about, atom.onto, atom.over].find((v) => isEntity(v) && entityKey(v) === sub?.from);
    if (sub && original) notes.push(`In ${record.ritualName} this act is performed with ${entityLabel(original, {})}; here it is applied to ${entityLabel(sub.to, {})}.`);
    if (item.substitute?.boundary) notes.push(`${record.ritualName} names a different threshold; here the crossing uses the ${entityLabel(item.substitute.boundary, {}).replace(/^the /, '')} prepared above.`);
    if (item.reason === 'requires') notes.push(`Added because the next act needs it; taken from the same passage of ${record.ritualName}.`);
    if (item.reason === 'dispose') notes.push('Whatever has taken up the unwanted condition must leave the rite; this disposal is borrowed from another act.');
    if (atom.verb === 'speak') {
      const words = item.words ?? speechWords(atom, { frame, goal: recipe.goal, central: index === central, carrier, source: record, previousVerb, schema: item.schema });
      cards.push({ id: `atom/${item.atomId}`, kind: 'composed', sourceId: `${record.ritualId}/${record.stepId}`, atomIds: [item.atomId], unitId: record.unitId,
        title: SPEECH_TITLES[atom.act], instruction: addresseeOf(atom, record) ? `Say to ${addresseeOf(atom, record)}` : atom.act === 'dismissal' ? 'Say to the unwanted condition' : 'Say aloud', words: capital(clean(words)), speechFunction: atom.act,
        carriesWish: index === central || !!item.words, addressee: addresseeOf(atom, record) ?? (atom.act === 'dismissal' ? 'the unwanted condition' : 'those present'),
        note: `Newly composed words on the pattern of a ${atom.act} in ${record.ritualName}; not a translation.`, evidence: evidenceFor(record),
        provenance, seam, schema: item.schema, slot: item.slot, reason: item.reason, notes });
      previousRitual = record; previousVerb = 'speak';
      return;
    }
    const last = cards.at(-1);
    let instruction = realizeAtom(atom, { adapted, substitute: item.substitute });
    if (item.gather?.length) instruction = `Have ${item.gather.map((g) => entityLabel(g, { adapted })).join(' and ')} ready. ${instruction}`;
    // Merge repeated acts from one step ("bring cheese", "bring bread") into one card.
    if (last && last.kind === 'source' && last.sourceId === `${record.ritualId}/${record.stepId}` && last.verb === atom.verb && !item.substitute
      && ['bring', 'take', 'place', 'offer', 'collect', 'select', 'pour', 'give'].includes(atom.verb) && !last.notes.length) {
      const noun = entityLabel(atom.theme, { adapted });
      last.objects.push(noun);
      last.instruction = `${last.head} ${last.objects.slice(0, -1).join(', ')} and ${last.objects.at(-1)}${last.tail}`;
      last.atomIds.push(item.atomId);
      return;
    }
    const firstObject = entityLabel(atom.theme, { adapted });
    const at = firstObject ? instruction.indexOf(firstObject) : -1;
    const head = at > 0 ? instruction.slice(0, at).trim() : instruction.split(' ')[0];
    const tail = at > 0 ? instruction.slice(at + firstObject.length) : '';
    cards.push({ id: `atom/${item.atomId}`, kind: 'source', sourceId: `${record.ritualId}/${record.stepId}`, atomIds: [item.atomId], unitId: record.unitId,
      instruction: capital(clean(instruction)), verb: atom.verb, head, tail, objects: [entityLabel(atom.theme, { adapted })], provenance, seam,
      recombined: !!(item.substitute || seam), ...(sub && carrierUnitId && carrierUnitId !== record.unitId ? { insetUnitId: carrierUnitId } : {}), schema: item.schema, slot: item.slot, reason: item.reason, notes, evidence: evidenceFor(record) });
    previousRitual = record; previousVerb = atom.verb;
  });
  if(frame?.prayer && cards.length) {
    const anchor=cards.at(-1);
    cards.push({...anchor,id:'modern-prayer',kind:'composed',title:'Speak your wish',instruction:'Say aloud',words:frame.prayer,carriesWish:true,note:'A modern prayer inspired by the selected actions.',notes:[],seam:null});
  }
  return cards.map(({ head, tail, objects, verb, ...card }) => card);
}

// A short, source-aware description of the plan's structure for the page header.
export function describePlan(recipe, schemas) {
  const records = (recipe.items ?? []).map((item) => atomById.get(item.atomId)).filter(Boolean);
  if (records.length && (recipe.items ?? []).every((item) => item.slot === 'attested' || item.reason === 'manual')) {
    const purpose = compositionIndex.find((step) => step.ritualId === records[0].ritualId)?.ritualPurpose ?? '';
    return { title: `Following ${records[0].ritualName}`, explanation: `${purpose} The acts below keep the tablet's order; the spoken words are composed for your wish.`, rituals: [records[0].ritualName], crossesTraditions: false };
  }
  const used = [...new Set((recipe.items ?? []).map((item) => item.schema).filter((id) => id && id !== 'arc'))];
  const rituals = [...new Set((recipe.items ?? []).map((item) => atomById.get(item.atomId)?.ritualName).filter(Boolean))];
  const traditions = new Set((recipe.items ?? []).map((item) => atomById.get(item.atomId)?.corpusId));
  return {
    title: used.map((id) => schemas[id]?.label).filter(Boolean).join(' · ') || 'A sequence of ritual acts',
    explanation: used.map((id) => schemas[id]?.reading).filter(Boolean).join(' '),
    rituals, crossesTraditions: traditions.size > 1,
  };
}
