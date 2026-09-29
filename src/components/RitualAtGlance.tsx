import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ritualStepHref, useRitualEdition } from "../lib/ritualEdition";
import { RitualStepThumbnail } from "./RitualStepArt";

/** A compact view of the actions compared across the CTH 402 copies. */
export default function RitualAtGlance({ ritualId }: { ritualId: string }) {
  const edition = useRitualEdition(ritualId);
  const steps = edition?.steps ?? [];
  const variant = edition?.variants[0];
  const strip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ first: 1, last: 1, atStart: true, atEnd: false });

  useEffect(() => {
    const scroller = strip.current;
    if (!scroller) return;
    const update = () => {
      const viewport = scroller.getBoundingClientRect();
      const cards = Array.from(scroller.querySelectorAll<HTMLElement>(".ritual-glance-card"));
      const fullyVisible = cards.map((card, index) => ({ rect: card.getBoundingClientRect(), index }))
        .filter(({ rect }) => rect.left >= viewport.left - 4 && rect.right <= viewport.right + 4);
      setPosition({
        first: (fullyVisible[0]?.index ?? 0) + 1,
        last: (fullyVisible.at(-1)?.index ?? 0) + 1,
        atStart: scroller.scrollLeft <= 2,
        atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2,
      });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => { scroller.removeEventListener("scroll", update); observer.disconnect(); };
  }, [edition, ritualId]);

  const move = (direction: -1 | 1) => {
    const scroller = strip.current;
    if (!scroller) return;
    const item = scroller.querySelector<HTMLElement>(".ritual-glance-item");
    const stride = item?.offsetWidth || 160;
    const count = Math.max(1, Math.floor(scroller.clientWidth / stride) - 1);
    scroller.scrollBy({ left: direction * stride * count, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  if (!edition) return null;
  return (
    <section className="ritual-glance" aria-labelledby="ritual-glance-title">
      <div className="ritual-glance-heading">
        <div>
          <p className="ritual-eyebrow">CTH {edition.cth} · {edition.shortName}</p>
          <h2 id="ritual-glance-title">Ritual at a glance</h2>
          <p>{ritualId === "allii" ? "Ten acts in the order shared where the copies overlap." : "Selected acts in the displayed sequence."} Select one to see its image and manuscript lines.</p>
        </div>
        <div className="ritual-glance-actions">
          <Link to={`/rituals/${ritualId}`} className="ritual-glance-cta">Play the sequence <span aria-hidden="true">↗</span></Link>
          <div className="ritual-glance-navigation" aria-label="Browse ritual steps">
            <span aria-live="polite">{String(position.first).padStart(2, "0")}–{String(position.last).padStart(2, "0")} <i>/</i> {String(steps.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => move(-1)} disabled={position.atStart} aria-label="Scroll to earlier steps">←</button>
            <button type="button" onClick={() => move(1)} disabled={position.atEnd} aria-label="Scroll to later steps">→</button>
          </div>
        </div>
      </div>
      <div className="ritual-glance-scroll" role="list" aria-label={`Selected ordered acts in the ritual of ${edition.shortName}`} ref={strip}>
        {steps.map((step, index) => (
          <div className="ritual-glance-item" role="listitem" key={step.id}>
            <Link to={ritualStepHref(edition, step)} className="ritual-glance-card" aria-label={`Step ${step.number}: ${step.title}. Copies ${step.attestations.map((a) => a.witness).join(", ")}`}>
              <span className="ritual-glance-number">{String(step.number).padStart(2, "0")}</span>
              <span className={`ritual-glance-icon${step.deityVisualId ? " paired" : ""}`}><RitualStepThumbnail step={step} /></span>
              <strong>{step.shortTitle}</strong>
              <small>{step.shortDescription}</small>
              <span className="ritual-glance-sigla" title={step.attestations.map((a) => `${a.witness}: ${a.doc.replaceAll("-", " ")}`).join("\n")}><em>Copies</em> {step.attestations.map((a) => a.witness).join(" ")}</span>
            </Link>
            {index < steps.length - 1 && <span className="ritual-glance-arrow" aria-hidden="true">→</span>}
          </div>
        ))}
      </div>
      {variant && <div className="ritual-glance-footer"><p><b>{ritualId === "allii" ? "Order variant:" : "Copy variant:"}</b> {variant.note} <Link to={`/rituals/${ritualId}#${ritualId === "allii" ? "order-variant" : variant.id}`}>{ritualId === "allii" ? "Compare A/C and H" : "Compare A and B"} ↗</Link></p></div>}
    </section>
  );
}
