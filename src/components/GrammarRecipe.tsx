import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { compileGrammarSteps, describePlan, type GrammarCard } from "../lib/ritualGrammarCards";
import { imageForGrammarCard } from "../lib/ritualCardImages";
import { GRAMMAR, SCHEMAS } from "../lib/ritualAtoms";
import type { PlanItem } from "../lib/ritualPlanner";
import type { GoalFrame } from "../lib/ritualGoal";
import { ritualUnitHref, sourceHref } from "../lib/ritualEdition";
import compositionIndex from "../data/rituals/composition-index.json";
import aimIndex from "../data/rituals/ritual-aims.json";
import functionIndex from "../data/rituals/ritual-functions.json";

const occurrenceById = new Map((compositionIndex as { ritualId: string; stepId: string; summary: string; ritualPurpose: string; aims: string[]; function: string }[]).map((item) => [`${item.ritualId}/${item.stepId}`, item]));
const aims = aimIndex as Record<string, string>;
const functions = functionIndex as Record<string, string>;

export interface GrammarState {
  goal: string; goalFrame: GoalFrame | null; mode: "historical" | "analogy" | "custom" | "preview"; fit: "historical" | "clear" | "loose";
  items: PlanItem[]; schemaScores?: Record<string, number>; aimScores?: Record<string, number>; scoring?: "jev" | "luna" | "offline" | null; actionScores?: Record<string, number>; planning?: { status?: string }; alternatives?: { items: PlanItem[] }[]; seed?: number;
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
  // Magnet pull: each new card flies up from its tile in the task library below
  // (speech cards rise from beneath the row), accelerating as it nears its slot,
  // then snaps in with a small overshoot. The source tile flinches as it is pulled.
  const shown = useRef(new Set<string>());
  const cardKey = cards.map((card) => card.id).join("|");
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const fresh = [...row.querySelectorAll<HTMLElement>("li[data-card-id]")].filter((li) => !shown.current.has(li.dataset.cardId!));
    shown.current = new Set(cards.map((card) => card.id));
    // A new ritual always starts at its first card.
    if (fresh.length === cards.length) row.scrollLeft = 0;
    if (!fresh.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (fresh.length === cards.length) {
      const box = row.getBoundingClientRect();
      if (box.bottom > window.innerHeight || box.top < 0) window.scrollBy({ top: box.top - Math.max(80, (window.innerHeight - box.height) / 2) });
    }
    const animations: Animation[] = [];
    fresh.forEach((li, index) => {
      const to = li.getBoundingClientRect();
      const tile = li.dataset.unitId ? document.querySelector<HTMLElement>(`.ritual-composer-task[data-unit-id="${CSS.escape(li.dataset.unitId)}"]`) : null;
      const from = tile?.getBoundingClientRect();
      const dx = from ? from.left + from.width / 2 - (to.left + to.width / 2) : (index % 2 ? 40 : -40);
      const dy = from ? Math.min(from.top + from.height / 2 - (to.top + to.height / 2), window.innerHeight) : 260;
      const tilt = (index % 2 ? 1 : -1) * (5 + (index % 3) * 2);
      const delay = index * 85;
      animations.push(li.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.55) rotate(${tilt}deg)`, opacity: 0.25, offset: 0 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(.7) rotate(${tilt * 0.6}deg)`, opacity: 0.8, offset: 0.45 },
        { transform: "translate(0, -7px) scale(1.045) rotate(0deg)", opacity: 1, offset: 0.8 },
        { transform: "translate(0, 2px) scale(.99)", offset: 0.91 },
        { transform: "none", opacity: 1, offset: 1 },
      ], { duration: 820, delay, easing: "cubic-bezier(.5,0,.25,1)", fill: "backwards" }));
      if (tile) animations.push(tile.animate([{ transform: "none" }, { transform: "scale(.9) translateY(-6px)", opacity: 0.45 }, { transform: "none", opacity: 1 }], { duration: 520, delay, easing: "ease-out" }));
    });
    // The row scrolls sideways, which would clip cards flying in from below.
    row.classList.add("is-pulling");
    const startAtFirst = fresh.length === cards.length;
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      row.classList.remove("is-pulling");
      // Restoring the scroll container can re-snap to a later card; a new ritual starts at card 1.
      if (startAtFirst) row.scrollLeft = 0;
      updateEdges();
    });
    return () => { animations.forEach((animation) => animation.cancel()); row.classList.remove("is-pulling"); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);
  // Show an arrow only when there is somewhere to go in that direction.
  const [edges, setEdges] = useState({ start: true, end: true });
  const updateEdges = () => {
    const row = rowRef.current;
    if (!row) return;
    setEdges({ start: row.scrollLeft <= 2, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 2 });
  };
  useLayoutEffect(() => {
    const row = rowRef.current;
    updateEdges();
    row?.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => { row?.removeEventListener("scroll", updateEdges); window.removeEventListener("resize", updateEdges); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);
  const slide = (direction: number) => rowRef.current?.scrollBy({ left: direction * rowRef.current.clientWidth, behavior: "smooth" });

  return <>
    {state.goalFrame?.title && <h2 className="ritual-generated-title">{state.goalFrame.title}</h2>}
    <details className="ritual-composer-logic grammar-logic">
      <summary className="ritual-eyebrow">{reading.title}</summary>
      <p>{reading.explanation}</p>
    </details>
    <div className="grammar-row">
      {!edges.start && <button type="button" className="grammar-row-arrow prev" aria-label="Previous cards" onClick={() => slide(-1)}>‹</button>}
      <ol className="grammar-cards" ref={rowRef}>
        {cards.map((card, index) => <li key={card.id} data-card-id={card.id} data-unit-id={card.kind === "source" ? card.unitId : undefined} className={`ritual-composer-picked${card.kind === "composed" ? " ritual-composer-speech" : ""}`}>
          <button type="button" className="ritual-composer-picked-main" onClick={() => setFocused(focused === card.id ? null : card.id)} aria-expanded={focused === card.id}>
            {card.kind === "composed" ? <>
              <span className="ritual-composer-speech-heading"><b>{index + 1}</b>{card.title}</span>
              <span className="ritual-composer-card-words">“{card.words}”</span>
              <small className="ritual-composer-composed-label">Composed words</small>
            </> : <>
              <span className="ritual-composer-image"><img src={imageForGrammarCard(card, state.items)} alt="" loading="lazy" /></span>
              <span className="ritual-composer-picked-title"><b>{index + 1}</b>{card.instruction}</span>
            </>}
            <span className="grammar-card-source" aria-hidden="true">{card.provenance.ritualName}</span>
          </button>
          <button className="ritual-composer-remove" type="button" aria-label={`Remove: ${card.instruction}`} onClick={() => remove(card)}>×</button>
        </li>)}
      </ol>
      {!edges.end && <button type="button" className="grammar-row-arrow next" aria-label="Next cards" onClick={() => slide(1)}>›</button>}
    </div>
    {focus && (() => {
      const source = occurrenceById.get(focus.sourceId);
      const quote = focus.evidence;
      const why = focus.slot === "focus" && source
        ? functions[source.function]
        : focus.schema === "arc"
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
        <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Source logic and composition</p><p>{why}{focus.notes.length ? ` ${focus.notes.join(" ")}` : ""}</p></div>
        {focus.schema !== "arc" && SCHEMAS[focus.schema] && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Reading “{state.goal}”</p><p>{SCHEMAS[focus.schema].reading}</p></div>}
        {typeof p === "number" && <details className="ritual-composer-decision">
          <summary>Jev’s assessment of this reading</summary>
          <p>{Math.round(p * 100)}% probability that this goal has the indicated structure.</p>
        </details>}
        {typeof planned?.jevActionScore === "number" && <p className="ritual-composer-decision">Mechanism fit: {planned.jevActionScore.toFixed(1)} / 3. This reflects Jev’s reading of the symbolic mechanism, not a separate judgment of this action.</p>}
        {manual && <p className="ritual-composer-decision ritual-composer-decision-manual">Added manually · no Jev score for this step.</p>}
      </div>;
    })()}
  </>;
}
