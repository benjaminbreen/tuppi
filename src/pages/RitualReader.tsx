import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import quoteIndex from "../data/rituals/quotes.json";
import { RitualStepPlate, RitualStepThumbnail } from "../components/RitualStepArt";
import { RITUAL_DEITIES, RITUAL_UNITS, relatedRitualUnits, ritualSequenceHref, ritualStepHref, ritualUnitHref, sourceHref, useRitualEdition, type RitualEdition, type RitualQuote, type RitualUnit } from "../lib/ritualEdition";

function indexFromQuery(raw: string | null, count: number) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : 0;
}

const ritualQuotes = (edition: RitualEdition, step: RitualUnit): RitualQuote[] => (quoteIndex as Record<string, RitualQuote[]>)[`${edition.id}/${step.id}`] ?? [];

function SourceLetters({ quotes }: { quotes: RitualQuote[] }) {
  return <div className="ritual-source-letters" aria-label="Manuscript copies"><span className="ritual-source-letters-label">Copies</span>{quotes.map((quote) => <span className="ritual-source-letter" key={`${quote.witness}-${quote.doc}`}>
    <button type="button" aria-label={`Copy ${quote.witness}: source quotation`} aria-describedby={`ritual-source-${quote.witness}`}>
      {quote.witness}
    </button>
    <span className="ritual-source-tooltip" id={`ritual-source-${quote.witness}`} role="tooltip">
      <span className="ritual-source-tooltip-head"><b>Copy {quote.witness}</b><span>{quote.locus}</span></span>
      <span className="ritual-source-tooltip-quote">“{quote.english ?? quote.original}”</span>
      <span className="ritual-source-tooltip-foot"><small>{quote.english ? "Draft English translation" : "Hittite transliteration"}</small></span>
    </span>
  </span>)}</div>;
}

function StepQuotations({ quotes }: { quotes: RitualQuote[] }) {
  const [index, setIndex] = useState(0);
  const quote = quotes[index];
  if (!quote) return null;
  return <section className="ritual-quote-panel" aria-label="Source quotation">
    <div className="ritual-quote-heading"><p className="ritual-eyebrow">From the tablet</p>{quotes.length > 1 && <div className="ritual-quote-switch" role="group" aria-label="Browse manuscript quotations"><span>{String(index + 1).padStart(2, "0")} / {String(quotes.length).padStart(2, "0")}</span><button type="button" onClick={() => setIndex((index - 1 + quotes.length) % quotes.length)} aria-label="Previous quotation">←</button><button type="button" onClick={() => setIndex((index + 1) % quotes.length)} aria-label="Next quotation">→</button></div>}</div>
    <blockquote className={quote.english ? "" : "transliteration"} lang={quote.english ? "en" : "hit"}>“{quote.english ?? quote.original}”</blockquote>
    <div className="ritual-quote-credit"><div><b>{quote.witness}</b><span>{quote.locus}</span><small>{quote.english ? "Draft English translation" : "Hittite transliteration"}</small></div><Link to={sourceHref(quote)}>Read source ↗</Link></div>
  </section>;
}

function VariantSection({ edition }: { edition: RitualEdition }) {
  return <>{edition.variants.map((variant) => {
    const names = Object.fromEntries(variant.units.map((unit) => [unit.id, unit.label]));
    return <section className="ritual-variant" id={variant.id === "burial-order" ? "order-variant" : variant.id} key={variant.id}>
      <div><p className="ritual-eyebrow">{variant.id === "burial-order" ? "Order variant" : "Copy variant"}</p><h2>{variant.title}</h2></div>
      <div><p>{variant.note}</p><div className="ritual-variant-paths">{variant.paths.map((path) => <div key={path.label}>
        <b>{path.label}</b><p>{path.order.map((id) => names[id]).join(" → ")}</p>
        <div className="ritual-source-actions">{path.sourceDocs.map((doc, index) => <Link key={doc} to={`/text/${doc}`}>Read {path.sourceLabels[index]} ↗</Link>)}</div>
      </div>)}</div></div>
    </section>;
  })}</>;
}

export function RitualSequence() {
  const { ritualId } = useParams();
  const edition = useRitualEdition(ritualId);
  if (edition === undefined) return <div className="wrap page" role="status">Loading ritual…</div>;
  if (edition === null) return <div className="wrap page"><h1>Ritual not found</h1><Link className="link" to="/rituals">Browse rituals</Link></div>;
  return <Sequence edition={edition} key={edition.id} />;
}

function Sequence({ edition }: { edition: RitualEdition }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [playing, setPlaying] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const index = indexFromQuery(params.get("step"), edition.steps.length);
  const step = edition.steps[index];

  useEffect(() => {
    if (!location.hash) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(edition.steps.length - 1, next));
    setParams((previous) => { const updated = new URLSearchParams(previous); updated.set("step", String(clamped + 1)); return updated; }, { replace: true });
  }, [edition.steps.length, setParams]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); setPlaying(false); go(index + (event.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  useEffect(() => {
    if (!playing) return;
    if (index === edition.steps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => go(index + 1), 1700);
    return () => window.clearTimeout(timer);
  }, [edition.steps.length, go, index, playing]);

  useEffect(() => {
    const container = rail.current;
    const node = container?.querySelector<HTMLElement>(`[data-step="${step.number}"]`);
    if (!container || !node) return;
    const left = node.offsetLeft - container.offsetLeft - (container.clientWidth - node.clientWidth) / 2;
    container.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [step.number]);

  const select = (next: number) => { setPlaying(false); go(next); };
  const play = () => { if (playing) { setPlaying(false); return; } if (index === edition.steps.length - 1) go(0); setPlaying(true); };
  const quotes = ritualQuotes(edition, step);
  const parallels = new Set(relatedRitualUnits(step.unitId).filter((item) => item.ritualId !== edition.id).map((item) => item.ritualId)).size;
  return <div className="wrap page ritual-page ritual-sequence-page">
    <div className="crumbs"><Link to="/rituals">Rituals</Link><span className="sep">/</span><span>{edition.shortName}</span></div>
    <header className="ritual-sequence-head"><div><p className="ritual-eyebrow">{edition.eyebrow}</p><div className="ritual-title-line"><h1>{edition.title}</h1><a className="ritual-date" href={edition.dating.sourceUrl} target="_blank" rel="noreferrer" title={edition.dating.note} aria-label={`${edition.dating.label}. ${edition.dating.note}`}>{edition.dating.label}</a></div></div><p>{edition.purpose}</p></header>
    <section className="ritual-stage" aria-label="Current ritual step">
      <div className="ritual-stage-image" key={step.id}><RitualStepPlate step={step} /></div>
      <div className="ritual-stage-copy" aria-live={playing ? "off" : "polite"}>
        <div className="ritual-stage-top"><SourceLetters quotes={quotes} /><div className="ritual-stage-top-actions"><span className="ritual-count">{String(step.number).padStart(2, "0")} <i>/</i> {edition.steps.length}</span><Link to={ritualStepHref(edition, step)} className="ritual-stage-details">More details <span aria-hidden="true">↗</span></Link></div></div>
        <div className="ritual-stage-main"><h2>{step.title}</h2><p className="ritual-stage-summary">{step.summary}</p>{parallels > 0 && <Link className="ritual-stage-parallel" to={`${ritualUnitHref(step.unitId)}#occurrences`}>Also in {parallels} other ritual{parallels === 1 ? "" : "s"} <span aria-hidden="true">↗</span></Link>}</div>
        <div className="ritual-controls" role="group" aria-label="Sequence controls"><button onClick={() => select(index - 1)} disabled={index === 0} aria-label="Previous step">←</button><button onClick={play} className="ritual-play" aria-label={playing ? "Pause sequence" : "Play sequence"}>{playing ? "Pause" : "Play"} <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span></button><button onClick={() => select(index + 1)} disabled={index === edition.steps.length - 1} aria-label="Next step">→</button></div>
      </div>
    </section>
    <div className="ritual-rail-head"><h2>The sequence</h2><span>Click any act · arrow keys to move</span></div>
    <div className="ritual-rail" ref={rail} aria-label={`${edition.shortName} ritual sequence`}>{edition.steps.map((item, i) => <div className="ritual-rail-item" key={item.id}>
      <button data-step={item.number} className={`ritual-mini ${i === index ? "active" : ""}`} aria-current={i === index ? "step" : undefined} onClick={() => select(i)} aria-label={`Step ${item.number}: ${item.title}`}><span className={`ritual-mini-image${item.deityVisualId ? " paired" : ""}`}><RitualStepThumbnail step={item} /></span><span className="ritual-mini-index">{String(item.number).padStart(2, "0")}</span><span className="ritual-mini-name">{item.shortTitle}</span><span className="ritual-mini-kind">{item.verb}</span></button>
      {i < edition.steps.length - 1 && <span className="ritual-chain-arrow" aria-hidden="true">→</span>}
    </div>)}</div>
    <div className="ritual-phase-key">{edition.phases.map((phase) => <button key={phase.name} onClick={() => select(phase.range[0] - 1)}><b>{phase.name}</b><span>{phase.range[0] === phase.range[1] ? phase.range[0] : `${phase.range[0]}–${phase.range[1]}`}</span><small>{phase.idea}</small></button>)}</div>
    <VariantSection edition={edition} />
  </div>;
}

export function RitualStepPage() {
  const { ritualId, stepId } = useParams();
  const edition = useRitualEdition(ritualId);
  const index = edition?.steps.findIndex((step) => step.id === stepId) ?? -1;
  if (edition === undefined) return <div className="wrap page" role="status">Loading ritual…</div>;
  if (edition === null) return <div className="wrap page"><h1>Ritual not found</h1><Link className="link" to="/rituals">Browse rituals</Link></div>;
  if (index < 0) return <div className="wrap page"><h1>Step not found</h1><Link className="link" to="/rituals">Browse rituals</Link></div>;
  const step = edition.steps[index];
  const quotes = ritualQuotes(edition, step);
  const unit = RITUAL_UNITS[step.unitId];
  const related = relatedRitualUnits(step.unitId);
  const otherRituals = new Set(related.filter((item) => item.ritualId !== edition.id).map((item) => item.ritualId)).size;
  const before = edition.steps[index - 1];
  const after = edition.steps[index + 1];
  return <div className="wrap page ritual-page">
    <div className="crumbs"><Link to="/rituals">Rituals</Link><span className="sep">/</span><Link to={ritualSequenceHref(edition, step)}>{edition.shortName}</Link><span className="sep">/</span><span>{String(step.number).padStart(2, "0")}</span></div>
    <header className="ritual-detail-head"><p className="ritual-eyebrow">Step {String(step.number).padStart(2, "0")} of {edition.steps.length} · {step.phase}</p><h1>{step.title}</h1><p>{step.summary}</p></header>
    <div className="ritual-detail-layout"><div className="ritual-detail-art"><RitualStepPlate step={step} /></div><div className="ritual-detail-sidebar">
      <section><p className="ritual-eyebrow">The {step.unitType === "utterance" ? "utterance" : "action"}</p><dl className="ritual-fields"><dt>Verb</dt><dd>{step.verb}</dd><dt>Object</dt><dd>{step.patient}</dd><dt>Actor</dt><dd>{step.actor}</dd>{step.recipient && <><dt>Recipient</dt><dd>{step.recipient}</dd></>}{step.place && <><dt>Place</dt><dd>{step.place}</dd></>}{step.material.length > 0 && <><dt>Materials</dt><dd>{step.material.join(" · ")}</dd></>}</dl></section>
      <StepQuotations key={step.id} quotes={quotes} />
      <section className="ritual-unit-pointer"><p className="ritual-eyebrow">Ritual task</p><h2>{unit.title}</h2><p>{otherRituals ? `Also appears in ${otherRituals} other ritual${otherRituals === 1 ? "" : "s"}.` : "One recorded ritual in this collection."}</p><Link to={`${ritualUnitHref(step.unitId)}#occurrences`}>See all occurrences ↗</Link></section>
      <section><p className="ritual-eyebrow">Manuscript lines</p><p className="ritual-detail-note">{step.evidence}</p><div className="ritual-attestations">{step.attestations.map((a) => <Link key={`${a.doc}-${a.anchor.index}`} to={sourceHref(a)}><b>{a.witness}</b><span>{a.locus}</span><span aria-hidden="true">↗</span></Link>)}</div><div className="ritual-source-actions"><a href={edition.editionUrl} target="_blank" rel="noreferrer">{edition.editionLabel ?? "Mainz edition"} ↗</a></div></section>
      <section><p className="ritual-eyebrow">Image details</p><p className="ritual-detail-note">{step.image.note}</p></section>
      {step.deityVisualId && <section className="ritual-deity-source"><p className="ritual-eyebrow">Relief model</p><p className="ritual-detail-note">{RITUAL_DEITIES[step.deityVisualId].note}</p><a href={RITUAL_DEITIES[step.deityVisualId].sourceUrl} target="_blank" rel="noreferrer">{RITUAL_DEITIES[step.deityVisualId].model} ↗</a></section>}
    </div></div>
    <nav className="ritual-neighbors" aria-label="Adjacent ritual steps"><span>{before && <Link to={ritualStepHref(edition, before)}><small>← Previous · {String(before.number).padStart(2, "0")}</small><b>{before.title}</b></Link>}</span><Link className="ritual-back" to={ritualSequenceHref(edition, step)}>View in sequence</Link><span>{after && <Link to={ritualStepHref(edition, after)}><small>Next · {String(after.number).padStart(2, "0")} →</small><b>{after.title}</b></Link>}</span></nav>
  </div>;
}
