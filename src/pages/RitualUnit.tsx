import actionMeanings from "../data/rituals/action-meanings.json";
import actionBindings from "../data/rituals/action-bindings.json";
import actionTemplates from "../data/rituals/action-templates.json";
import compositionIndex from "../data/rituals/composition-index.json";
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
  const bindings = actionBindings as Record<string, { templateId: string; actor: string; target: string; bodyPart: string; medium: string; accompaniment: string }>;
  const templates = actionTemplates as Record<string, { label: string; matchRule: string }>;
  const templateId = related.map((item) => bindings[`${item.ritualId}/${item.stepId}`]?.templateId).find(Boolean);
  const template = templateId ? templates[templateId] : undefined;
  const variants = templateId ? compositionIndex.filter((item) => bindings[`${item.ritualId}/${item.stepId}`]?.templateId === templateId) : [];
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
  const context = first && compositionIndex.find((item) => item.ritualId === first.ritualId && item.stepId === first.stepId);
  const meanings = Object.entries(actionMeanings).filter(([,m]) => related.some(o=>m.evidence.source===`${o.ritualId}/${o.stepId}`)).map(([,m])=>m);
  const mechanisms = [...new Set(meanings.flatMap(m=>m.tags))];
  const purposes = [...new Set(meanings.flatMap(m=>m.purpose))];
  const isShamash = unitId === "libu-release-bargain";
  return <div className="wrap page ritual-page ritual-unit-page">
    <div className="crumbs"><Link to="/rituals">Rituals</Link><span className="sep">/</span><span>Actions</span><span className="sep">/</span><span>{unit.title}</span></div>
    <header className="ritual-unit-head"><div><p className="ritual-eyebrow">Ritual action</p><h1>{unit.title}</h1><p>{unit.description}</p></div><div className="ritual-unit-count"><strong>{String(ritualCount).padStart(2, "0")}</strong><span>{ritualCount === 1 ? "ritual" : "rituals"}</span><small>{related.length} recorded {related.length === 1 ? "passage" : "passages"}</small></div></header>
    <div className="ritual-unit-overview">
      <div className="ritual-unit-art"><div className="ritual-plate"><div className="ritual-plate-ring" aria-hidden="true" /><img src={deity?.src ?? visual.src} alt={deity ? `Illustrated stone relief type for ${deity.label.toLowerCase()}` : visual.subject} /></div><span>{deity ? `AI-generated relief type · ${deity.label}` : visual.medium}</span></div>
      <div className="ritual-unit-intro"><p className="ritual-eyebrow">In the ritual</p><p>{context?.ritualPurpose ?? (first ? `This action appears in ${first.ritualName}.` : unit.description)}</p>{first && <p className="ritual-unit-context-link"><Link to={`/rituals/${first.ritualId}/step/${first.stepId}`}>See step {first.stepNumber} in {first.ritualName} ↗</Link></p>}{deity && <div className="ritual-unit-deity-note"><p>{isShamash ? "Šamaš was the Mesopotamian sun god. This image takes its form from a Hittite Sun-god relief at Yazılıkaya." : deity.note}</p>{isShamash && <a href="https://oracc.museum.upenn.edu/amgg/Listofdeities/UtuShamash/index.html" target="_blank" rel="noreferrer">About Šamaš ↗</a>}<a href={deity.sourceUrl} target="_blank" rel="noreferrer">About the image ↗</a></div>}<a href="#occurrences">Read source passages <span aria-hidden="true">↓</span></a></div>
    </div>
    {!!meanings.length && <section className="ritual-composer-logic"><p className="ritual-eyebrow">Meaning and structure</p><p><strong>Historical purpose:</strong> {purposes.join(" · ")}</p><p><strong>Symbolic mechanisms:</strong> {mechanisms.join(" · ")}</p><ul>{meanings.filter((m,i,all)=>all.findIndex(x=>x.action===m.action && x.logic===m.logic)===i).map((m,i)=><li key={i}><strong>{m.action}</strong> — {m.logic} <small>({m.role})</small></li>)}</ul><p>Editorial interpretation of the source annotations; accompanying gestures and speech remain linked to their passages.</p></section>}
    {template && <section className="ritual-composer-logic"><p className="ritual-eyebrow">Related actions · {template.label}</p><p>These rituals use a similar action with different people or materials.</p><ul>{variants.map((item) => {
      return <li key={`${item.ritualId}/${item.stepId}`}><Link to={ritualUnitHref(item.unitId)}>{item.stepTitle}</Link> — {item.ritualName}.</li>;
    })}</ul></section>}
    <section id="occurrences" className="ritual-unit-occurrences"><div className="ritual-unit-section-head"><div><h2>Where this task appears</h2></div><span>{String(related.length).padStart(2, "0")} occurrences</span></div>
      <div className="ritual-unit-rows">{related.map((occurrence) => {
        const quote = quoteIndex[`${occurrence.ritualId}/${occurrence.stepId}`]?.find((item) => item.english) ?? quoteIndex[`${occurrence.ritualId}/${occurrence.stepId}`]?.[0];
        return <article key={`${occurrence.ritualId}-${occurrence.stepId}`} className="ritual-unit-row">
          <div className="ritual-unit-row-id"><span>{occurrence.sourceLabel ?? `CTH ${occurrence.cth}`}</span><strong>{occurrence.ritualName}</strong><small>Step {String(occurrence.stepNumber).padStart(2, "0")}</small></div>
          <div className="ritual-unit-row-main"><Link to={`/rituals/${occurrence.ritualId}/step/${occurrence.stepId}`}>{occurrence.stepTitle} <span aria-hidden="true">↗</span></Link>{quote && <><blockquote lang={quote.english ? "en" : quote.language === "sux-akk" ? "mul" : quote.language ?? "hit"}>“{quote.english ?? quote.original}”</blockquote><div className="ritual-unit-source"><span>{quote.locus}</span><Link to={sourceHref(quote)}>Read source ↗</Link></div></>}</div>
        </article>;
      })}</div>
    </section>
    <nav className="ritual-unit-end"><Link to="/rituals">Browse rituals ↗</Link><Link to={ritualUnitHref(unitId)}>Back to top ↑</Link></nav>
  </div>;
}
