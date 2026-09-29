import { useEffect, useState } from "react";
import actionTypes from "../data/rituals/action-types.json";
import occurrences from "../data/rituals/occurrences.json";
import unitIndex from "../data/rituals/units.json";
import visualIndex from "../data/rituals/visual-assets.json";
import deityIndex from "../data/rituals/deity-visuals.json";

export interface RitualAttestation {
  witness: string;
  doc: string;
  locus: string;
  anchor: { kind: "line" | "paragraph"; index: number };
  note?: string;
}

export interface RitualQuote extends RitualAttestation {
  original: string;
  english?: string;
}

export interface RitualUnit {
  id: string;
  unitId: string;
  number: number;
  title: string;
  shortTitle: string;
  shortDescription: string;
  phase: string;
  unitType: "act" | "utterance";
  actionType: string;
  verb: string;
  summary: string;
  patient: string;
  actor: string;
  material: string[];
  recipient?: string;
  deityVisualId?: string;
  deityLabel?: string;
  place?: string;
  evidence: string;
  image: { alt: string; note: string; brief?: string };
  attestations: RitualAttestation[];
}

export interface RitualOrderVariant {
  id: string;
  title: string;
  note: string;
  units: { id: string; label: string }[];
  paths: { label: string; order: string[]; sourceDocs: string[]; sourceLabels: string[] }[];
}

export interface RitualEdition {
  id: string;
  cth: number;
  title: string;
  shortName: string;
  eyebrow: string;
  dating: { label: string; note: string; sourceUrl: string };
  purpose: string;
  attribution: string;
  sourceSummary: string;
  editionUrl: string;
  phases: { name: string; range: number[]; idea: string }[];
  variants: RitualOrderVariant[];
  steps: RitualUnit[];
}

export const ACTION_TYPES: Record<string, { title: string; definition: string; externalParallels: { ritual: string; description: string; source: string; href: string }[] }> = actionTypes;
export interface CanonicalRitualUnit { title: string; description: string; matchRule?: string; actionType: string; unitType: "act" | "utterance"; visualAssetId: string; deityVisualId?: string }
export interface RitualVisualAsset { src: string; subject: string; medium: string }
export interface RitualDeityVisual { src: string; label: string; model: string; sourceUrl: string; note: string }
export const RITUAL_UNITS = unitIndex as Record<string, CanonicalRitualUnit>;
export const RITUAL_VISUALS = visualIndex as Record<string, RitualVisualAsset>;
export const RITUAL_DEITIES = deityIndex as Record<string, RitualDeityVisual>;
export const ritualUnitObjectImage = (step: RitualUnit) => RITUAL_VISUALS[RITUAL_UNITS[step.unitId].visualAssetId].src;
export const ritualUnitImage = (step: RitualUnit) => {
  const deityId = RITUAL_UNITS[step.unitId].deityVisualId;
  return deityId ? RITUAL_DEITIES[deityId].src : ritualUnitObjectImage(step);
};
const modules = import.meta.glob(["../data/rituals/*.json", "!../data/rituals/action-types.json", "!../data/rituals/catalog.json", "!../data/rituals/deity-visuals.json", "!../data/rituals/occurrences.json", "!../data/rituals/quotes.json", "!../data/rituals/units.json", "!../data/rituals/visual-assets.json"]);
const cache = new Map<string, Promise<RitualEdition>>();
export function loadRitualEdition(id: string) {
  const key = `../data/rituals/${id}.json`;
  const loader = modules[key];
  if (!loader) return Promise.resolve(null);
  if (!cache.has(id)) cache.set(id, loader().then((module) => (module as { default: RitualEdition }).default));
  return cache.get(id)!;
}
export function useRitualEdition(id: string | undefined) {
  const [result, setResult] = useState<{ id: string; edition: RitualEdition | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    loadRitualEdition(id).then((value) => { if (active) setResult({ id, edition: value }); });
    return () => { active = false; };
  }, [id]);
  if (!result || result.id !== id) return undefined;
  return result.edition;
}
export const ritualStepHref = (edition: RitualEdition, step: RitualUnit) => `/rituals/${edition.id}/step/${step.id}`;
export const ritualSequenceHref = (edition: RitualEdition, step?: RitualUnit) => `/rituals/${edition.id}${step ? `?step=${step.number}` : ""}`;
export const sourceHref = (attestation: RitualAttestation) => `/text/${attestation.doc}#${attestation.anchor.kind === "line" ? "L" : "P"}${attestation.anchor.index}`;
export interface RitualOccurrence { ritualId: string; ritualName: string; cth: number; stepId: string; stepNumber: number; stepTitle: string }
export const relatedRitualUnits = (unitId: string): RitualOccurrence[] => (occurrences as Record<string, RitualOccurrence[]>)[unitId] ?? [];
export const ritualUnitHref = (unitId: string) => `/ritual-units/${unitId}`;
