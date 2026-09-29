import { RITUAL_DEITIES, RITUAL_UNITS, ritualUnitImage, ritualUnitObjectImage, type RitualUnit } from "../lib/ritualEdition";

function artwork(step: RitualUnit) {
  const deity = step.deityVisualId ? RITUAL_DEITIES[step.deityVisualId] : undefined;
  const deityFirst = !!deity && RITUAL_UNITS[step.unitId].deityVisualId === step.deityVisualId;
  return { deity, deityFirst, objectSrc: ritualUnitObjectImage(step) };
}

export function RitualStepPlate({ step }: { step: RitualUnit }) {
  const { deity, deityFirst, objectSrc } = artwork(step);
  const deityLabel = step.deityLabel ?? deity?.label;
  return <div className={`ritual-plate${deity ? " ritual-plate-paired" : ""}`}>
    <div className="ritual-plate-ring" aria-hidden="true" />
    {deity ? <div className={`ritual-plate-pair${deityFirst ? " deity-first" : ""}`}>
      {deityFirst && <div className="ritual-plate-deity"><img src={deity.src} alt={`Illustrated stone relief type for ${deityLabel?.toLowerCase()}`} /><span>{deityLabel} · reconstruction</span></div>}
      <div className="ritual-plate-object"><img src={objectSrc} alt={step.image.alt} /></div>
      {!deityFirst && <div className="ritual-plate-deity"><img src={deity.src} alt={`Illustrated stone relief type for ${deityLabel?.toLowerCase()}`} /><span>{deityLabel} · reconstruction</span></div>}
    </div> : <img src={objectSrc} alt={step.image.alt} decoding="async" />}
  </div>;
}

export function RitualStepThumbnail({ step }: { step: RitualUnit }) {
  const { deity, deityFirst, objectSrc } = artwork(step);
  return <>
    <img src={ritualUnitImage(step)} alt="" loading="lazy" />
    {deity && <img className="ritual-thumb-secondary" src={deityFirst ? objectSrc : deity.src} alt="" loading="lazy" />}
  </>;
}
