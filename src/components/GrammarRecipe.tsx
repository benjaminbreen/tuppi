import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { compileGrammarSteps, describePlan, type GrammarCard } from "../lib/ritualGrammarCards";
import { GRAMMAR, SCHEMAS } from "../lib/ritualAtoms";
import type { PlanItem } from "../lib/ritualPlanner";
import type { GoalFrame } from "../lib/ritualGoal";
import { RITUAL_DEITIES, RITUAL_UNITS, RITUAL_VISUALS, ritualUnitHref, sourceHref } from "../lib/ritualEdition";
import compositionIndex from "../data/rituals/composition-index.json";
import aimIndex from "../data/rituals/ritual-aims.json";
import functionIndex from "../data/rituals/ritual-functions.json";

const occurrenceById = new Map((compositionIndex as { ritualId: string; stepId: string; summary: string; ritualPurpose: string; aims: string[]; function: string }[]).map((item) => [`${item.ritualId}/${item.stepId}`, item]));
const aims = aimIndex as Record<string, string>;
const functions = functionIndex as Record<string, string>;

export interface GrammarState {
  goal: string; goalFrame: GoalFrame | null; mode: "historical" | "analogy" | "custom" | "preview"; fit: "historical" | "clear" | "loose";
  items: PlanItem[]; schemaScores?: Record<string, number>; aimScores?: Record<string, number>; scoring?: "jev" | "luna" | "offline" | null; alternatives?: { items: PlanItem[] }[]; seed?: number;
}


function imageFor(unitId: string) {
  const unit = RITUAL_UNITS[unitId];
  if (!unit) return "/rituals/_pending.png";
  return unit.deityVisualId ? RITUAL_DEITIES[unit.deityVisualId].src : RITUAL_VISUALS[unit.visualAssetId]?.src ?? "/rituals/_pending.png";
}

export default function GrammarRecipe({ state, onItems }: { state: GrammarState; onItems: (items: PlanItem[]) => void }) {
  const [focused, setFocused] = useState<string | null>(null);
  const cards = compileGrammarSteps(state);
  const reading = describePlan(state, SCHEMAS);
  const focus = cards.find((card) => card.id === focused);

  function remove(card: GrammarCard) {
    const gone = new Set(card.atomIds);
    onItems(state.items.filter((item) => !gone.has(item.atomId)));
    if (focused === card.id) setFocused(null);
  }

  const rowRef = useRef<HTMLOListElement>(null);
  const slide = (direction: number) => rowRef.current?.scrollBy({ left: direction * rowRef.current.clientWidth, behavior: "smooth" });

  return <>
    {state.goalFrame && <div className="ritual-composer-wish"><p className="ritual-eyebrow">Your aim</p><p>{state.goalFrame.wish}</p></div>}
    <div className="ritual-composer-logic">
      <p className="ritual-eyebrow">{reading.title}</p>
      <p>{reading.explanation}</p>
    </div>
    <div className="grammar-row">
      {cards.length > 5 && <button type="button" className="grammar-row-arrow prev" aria-label="Previous cards" onClick={() => slide(-1)}>‹</button>}
      <ol className="grammar-cards" ref={rowRef}>
        {cards.map((card, index) => <li key={card.id} className={`ritual-composer-picked${card.kind === "composed" ? " ritual-composer-speech" : ""}`}>
          <button type="button" className="ritual-composer-picked-main" onClick={() => setFocused(focused === card.id ? null : card.id)} aria-expanded={focused === card.id}>
            {card.kind === "composed" ? <>
              <span className="ritual-composer-speech-heading"><b>{index + 1}</b>{card.title}</span>
              <span className="ritual-composer-card-words">“{card.words}”</span>
              <small className="ritual-composer-composed-label">Composed words</small>
            </> : <>
              <span className="ritual-composer-image"><img src={imageFor(card.unitId)} alt="" loading="lazy" /></span>
              <span className="ritual-composer-picked-title"><b>{index + 1}</b>{card.instruction}</span>
            </>}
            <span className="grammar-card-source" aria-hidden="true">{card.provenance.ritualName}</span>
          </button>
          <button className="ritual-composer-remove" type="button" aria-label={`Remove: ${card.instruction}`} onClick={() => remove(card)}>×</button>
        </li>)}
      </ol>
      {cards.length > 5 && <button type="button" className="grammar-row-arrow next" aria-label="Next cards" onClick={() => slide(1)}>›</button>}
    </div>
    {focus && (() => {
      const source = occurrenceById.get(focus.sourceId);
      const quote = focus.evidence;
      const why = focus.schema === "arc"
        ? GRAMMAR.arc.why?.[focus.slot] ?? ""
        : SCHEMAS[focus.schema]?.slots.find((slot) => slot.id === focus.slot)?.why ?? "";
      const planned = state.items.find((item) => item.atomId === focus.atomIds[0]);
      const p = planned?.jevProbability;
      const manual = planned?.reason === "manual";
      return <div className="ritual-composer-detail" aria-label={focus.kind === "composed" ? "Composed ritual step" : "Original source context"}>
        <button className="ritual-composer-detail-close" type="button" aria-label="Close details" onClick={() => setFocused(null)}>×</button>
        {focus.kind === "composed" ? <>
          <div><p className="ritual-eyebrow">Composed for this ritual</p><h2>{focus.title}</h2><p>{focus.note}</p></div>
          <div><p className="ritual-eyebrow">Spoken words</p><blockquote>“{focus.words}”</blockquote><p>Addressee: {focus.addressee}. These words are a modern adaptation.</p></div>
          <div><p className="ritual-eyebrow">Modelled on</p>{quote && <blockquote>{quote.original ? quote.text : `“${quote.text}”`}</blockquote>}<div className="ritual-composer-links"><Link to={`/rituals/${focus.provenance.ritualId}/step/${focus.provenance.stepId}`}>Source passage ↗</Link></div></div>
        </> : <>
          <div><p className="ritual-eyebrow">{focus.provenance.ritualName} · {focus.provenance.sourceLabel} · step {focus.provenance.stepNumber}</p><h2>{focus.provenance.stepTitle}</h2><p>{source?.summary}</p></div>
          <div><p className="ritual-eyebrow">Original context</p><p>{source?.ritualPurpose}</p><p className="ritual-composer-context">{source?.aims.map((aim) => aims[aim]).join(" ")} {source ? functions[source.function] : ""}</p></div>
          <div><p className="ritual-eyebrow">From the text</p>{quote && <blockquote>{quote.original ? quote.text : `“${quote.text}”`}</blockquote>}
            <div className="ritual-composer-links"><Link to={`/rituals/${focus.provenance.ritualId}/step/${focus.provenance.stepId}`}>Open step ↗</Link><Link to={ritualUnitHref(focus.unitId)}>Task across rituals ↗</Link>{!!quote?.source && <Link to={sourceHref(quote.source as never)}>Read tablet ↗</Link>}</div>
          </div>
        </>}
        <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Why these acts belong together</p><p>{why}{focus.notes.length ? ` ${focus.notes.join(" ")}` : ""}</p></div>
        {focus.schema !== "arc" && SCHEMAS[focus.schema] && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Reading “{state.goal}”</p><p>{SCHEMAS[focus.schema].reading}</p></div>}
        {typeof p === "number" && <details className="ritual-composer-decision">
          <summary>Jev’s assessment of these connected actions</summary>
          <p>{Math.round(p * 100)}% match estimate for this sequence.</p>
        </details>}
        {manual && <p className="ritual-composer-decision ritual-composer-decision-manual">Added manually · no Jev score for this step.</p>}
      </div>;
    })()}
  </>;
}
