import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import quotes from "../data/rituals/quotes.json";
import { RITUAL_DEITIES, RITUAL_UNITS, RITUAL_VISUALS, relatedRitualUnits, ritualUnitHref, sourceHref, type RitualQuote } from "../lib/ritualEdition";

const quoteIndex = quotes as Record<string, RitualQuote[]>;

export default function RitualUnitPage() {
  const { unitId } = useParams();
  const location = useLocation();
  const unit = unitId ? RITUAL_UNITS[unitId] : undefined;
  const related = unitId ? relatedRitualUnits(unitId) : [];
  const ritualCount = new Set(related.map((occurrence) => occurrence.ritualId)).size;

  useEffect(() => {
    if (!location.hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [location.hash, unitId]);

  if (!unit || !unitId) return <div className="wrap page"><h1>Ritual task not found</h1><Link className="link" to="/rituals">Browse rituals</Link></div>;
  const visual = RITUAL_VISUALS[unit.visualAssetId];
  const deity = unit.deityVisualId ? RITUAL_DEITIES[unit.deityVisualId] : undefined;
  const first = related[0];
  const firstQuote = first && (quoteIndex[`${first.ritualId}/${first.stepId}`]?.find((item) => item.english) ?? quoteIndex[`${first.ritualId}/${first.stepId}`]?.[0]);
  return <div className="wrap page ritual-page ritual-unit-page">
    <div className="crumbs"><Link to="/rituals">Rituals</Link><span className="sep">/</span><span>Tasks</span><span className="sep">/</span><span>{unit.title}</span></div>
    <header className="ritual-unit-head"><div><p className="ritual-eyebrow">Ritual task</p><h1>{unit.title}</h1><p>{unit.description}</p></div><div className="ritual-unit-count"><strong>{String(ritualCount).padStart(2, "0")}</strong><span>{ritualCount === 1 ? "ritual" : "rituals"}</span><small>{related.length} recorded {related.length === 1 ? "occurrence" : "occurrences"}</small></div></header>
    <div className="ritual-unit-overview">
      <div className="ritual-unit-art"><div className="ritual-plate"><div className="ritual-plate-ring" aria-hidden="true" /><img src={deity?.src ?? visual.src} alt={deity ? `Illustrated stone relief type for ${deity.label.toLowerCase()}` : visual.subject} /></div><span>{deity ? `AI-generated relief type · ${deity.label}` : visual.medium}</span></div>
      <div className="ritual-unit-intro"><p className="ritual-eyebrow">{unit.matchRule ? "The comparison" : "From the tablet"}</p>{unit.matchRule ? <p>{unit.matchRule}</p> : firstQuote ? <p>“{firstQuote.english ?? firstQuote.original}”</p> : null}{deity && <div className="ritual-unit-deity-note"><p>{deity.note}</p><a href={deity.sourceUrl} target="_blank" rel="noreferrer">{deity.model} ↗</a></div>}<a href="#occurrences">View source passages <span aria-hidden="true">↓</span></a></div>
    </div>
    <section id="occurrences" className="ritual-unit-occurrences"><div className="ritual-unit-section-head"><div><h2>Where this task appears</h2></div><span>{String(related.length).padStart(2, "0")} occurrences</span></div>
      <div className="ritual-unit-rows">{related.map((occurrence) => {
        const quote = quoteIndex[`${occurrence.ritualId}/${occurrence.stepId}`]?.find((item) => item.english) ?? quoteIndex[`${occurrence.ritualId}/${occurrence.stepId}`]?.[0];
        return <article key={`${occurrence.ritualId}-${occurrence.stepId}`} className="ritual-unit-row">
          <div className="ritual-unit-row-id"><span>CTH {occurrence.cth}</span><strong>{occurrence.ritualName}</strong><small>Step {String(occurrence.stepNumber).padStart(2, "0")}</small></div>
          <div className="ritual-unit-row-main"><Link to={`/rituals/${occurrence.ritualId}/step/${occurrence.stepId}`}>{occurrence.stepTitle} <span aria-hidden="true">↗</span></Link>{quote && <><blockquote lang={quote.english ? "en" : "hit"}>“{quote.english ?? quote.original}”</blockquote><div className="ritual-unit-source"><span>{quote.locus}</span><Link to={sourceHref(quote)}>Read source ↗</Link></div></>}</div>
        </article>;
      })}</div>
    </section>
    <nav className="ritual-unit-end"><Link to="/rituals">Browse rituals ↗</Link><Link to={ritualUnitHref(unitId)}>Back to top ↑</Link></nav>
  </div>;
}
