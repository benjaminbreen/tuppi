import actions from '../data/rituals/atom-index.json' with { type: 'json' };
import steps from '../data/rituals/composition-index.json' with { type: 'json' };
import functions from '../data/rituals/ritual-functions.json' with { type: 'json' };
import { realizeAtom } from './ritualAtoms.js';

// Editorial interpretations of the existing action/function annotations, not new
// attestations. Provenance stays local; the selector receives only useful meaning.
const purpose = {
 'avert-plague':'plague relief', 'undo-bewitchment':'counter sorcery',
 'cleanse-impurity':'purification', 'seek-descendants':'offspring',
 'restore-procreative-power':'male procreative power', 'tend-dead':'care for the dead',
 'avert-harm':'protection', 'heal-illness':'healing',
 'appease-angry-god':'reconciliation with offended deity',
 'secure-army-victory':'military victory', 'restore-potency':'male potency',
 'restore-health':'health restoration',
};
const mechanisms = {
 'prepare-material':'preparation', 'place-deposit':'contact deposit',
 'remove-deposit':'remove deposit', 'purify-by-analogy':'cleansing analogy',
 'make-offering':'gift exchange', 'invoke-help':'petition', 'collect-material':'preparation',
 'construct-setting':'ritual setting', 'fashion-figure':'representation',
 'mark-subject':'mark identity', 'transfer-affliction':'burden transfer',
 'destroy-affliction':'destruction of carrier', 'wash-clean':'cleansing',
 'remove-mark':'remove marker', 'discard-carrier':'disposal',
 'cross-threshold':'transition', 'affirm-cleansing':'completion',
 'seek-fertility':'analogy of increase', 'dispatch-substitute':'substitution and expulsion',
 'appease-divinity':'appeasement', 'return-harm':'return to sender',
 'sleep-over-deposit':'overnight contact', 'cook-offering':'offering preparation',
 'kill-for-offering':'sacrificial preparation', 'clear-setting':'completion',
 'seal-threshold':'protective boundary', 'read-omen':'divination',
 'carry-dead':'funeral transport', 'cremate-dead':'cremation',
 'place-in-carrier':'load carrier', 'chant-at-threshold':'boundary crossing',
 'confess-offence':'acknowledgment of fault', 'promise-restitution':'restitution',
 'seek-divine-disclosure':'reveal hidden cause', 'disable-enemy':'constrain opponent',
 'apply-remedy':'medical application', 'prepare-remedy':'medical preparation',
 'administer-remedy':'medical treatment', 'expose-remedy':'overnight exposure',
 'recite-incantation':'healing incantation',
};
const preparation = new Set(['bring','collect','combine','shape','build','select','crush','cook']);
const support = new Set(['prepare-material','collect-material','construct-setting','prepare-remedy','cook-offering','place-in-carrier']);
const completion = new Set(['discard-carrier','affirm-cleansing','clear-setting','remove-deposit']);
const byStep = new Map(steps.map(s=>[`${s.ritualId}/${s.stepId}`,s]));
export function interpretAction(a) {
 const step=byStep.get(`${a.ritualId}/${a.stepId}`);
 if(!step || !functions[a.function] || !mechanisms[a.function]) throw new Error(`Missing action meaning: ${a.id}`);
 const preparatory=preparation.has(a.atom.verb) && !['fashion-figure','destroy-affliction'].includes(a.function);
 const role=preparatory || support.has(a.function) ? 'prepare' : completion.has(a.function) ? 'complete' : 'central';
 const tags=[preparatory ? 'preparation' : mechanisms[a.function]];
 // Function describes the entire source step. Do not assign its full effect to
 // an ingredient merely brought there. Speech needs its particular proposition.
 let logic=preparatory ? 'Prepare this material for the following act.' : functions[a.function];
 if(a.atom.verb==='speak') logic=step.summary;
 else if(a.atom.note) logic=a.atom.note;
 if(a.atom.verb==='exchange') { tags.splice(0,1,'role exchange'); logic='Exchange gendered implements to change the subject’s ritual role.'; }
 if(a.atom.verb==='sleep' && a.function==='sleep-over-deposit') logic='Maintain overnight contact with the deposit; this is not dream divination.';
 return { action:realizeAtom(a.atom), purpose:[...new Set(a.aims.map(id=>purpose[id] ?? id))], tags, role, logic,
   evidence:{source:`${a.ritualId}/${a.stepId}`,function:a.function,basis:a.atom.verb==='speak'?'source-step summary':'annotated operation and function'} };
}
export const ACTION_MEANINGS=Object.fromEntries(actions.map(a=>[a.id,interpretAction(a)]));
export function selectorMeaning(a) { const {evidence,...meaning}=ACTION_MEANINGS[a.id];return meaning; }
