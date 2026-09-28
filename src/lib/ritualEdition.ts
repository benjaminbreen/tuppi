import { useEffect, useState } from "react";
import actionTypes from "../data/rituals/action-types.json";
import occurrences from "../data/rituals/occurrences.json";

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
  place?: string;
  evidence: string;
  image: { src: string; alt: string; note: string; brief?: string };
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
const modules = import.meta.glob(["../data/rituals/*.json", "!../data/rituals/action-types.json", "!../data/rituals/catalog.json", "!../data/rituals/occurrences.json", "!../data/rituals/quotes.json"]);
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
export const relatedRitualUnits = (actionType: string): RitualOccurrence[] => (occurrences as Record<string, RitualOccurrence[]>)[actionType] ?? [];
