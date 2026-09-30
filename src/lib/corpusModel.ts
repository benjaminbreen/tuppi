import type { DateRange } from "./corpora";

/** Provider-neutral records. Adapters retain the provider's original ID and URL. */
export interface SourceRef {
  corpusId: string;
  sourceId: string;
  sourceUrl: string;
  edition?: string;
  locus?: string;
}
export interface PlaceRef {
  label: string;
  role: "findspot" | "origin" | "mentioned";
  latitude?: number;
  longitude?: number;
  confidence?: "identified" | "proposed" | "regional";
}
export interface CorpusText {
  id: string;
  corpusId: string;
  source: SourceRef;
  title: string;
  languages: string[];
  genres: string[];
  compositionDate?: DateRange;
  places: PlaceRef[];
  witnessIds: string[];
  procedureIds: string[];
}
export interface CorpusWitness {
  id: string;
  textId: string;
  source: SourceRef;
  siglum?: string;
  witnessDate?: DateRange;
  places: PlaceRef[];
  passageIds: string[];
}
export interface CorpusPassage {
  id: string;
  witnessId: string;
  source: SourceRef;
  position: number;
  transliteration?: string;
  translation?: string;
  language?: string;
  tokenIds?: string[];
}
export interface CorpusProcedure {
  id: string;
  textId: string;
  title: string;
  kind: "ritual" | "medical" | "other";
  evidencePassageIds: string[];
  actionIds: string[];
  completeness: "complete" | "partial" | "uncertain";
}
export interface CorpusMaterialAttestation {
  id: string;
  corpusId: string;
  lemma: string;
  gloss: string;
  class: "plant" | "mineral" | "animal" | "food" | "other";
  source: SourceRef;
  identification: "source-gloss" | "tentative" | "unidentified";
}
export interface CorpusConditionAttestation {
  id: string;
  corpusId: string;
  label: string;
  source: SourceRef;
  kind: "symptom" | "condition" | "etiology";
  interpretationNote?: string;
}
export interface ComparisonClaim {
  id: string;
  subjectProcedureId?: string;
  subject: SourceRef;
  object: SourceRef;
  relationship: "same-lexeme" | "translation" | "candidate-material" | "candidate-condition" | "analogous-action";
  rationale: string;
  evidence: SourceRef[];
  confidence: "high" | "medium" | "low";
  status: "proposed" | "reviewed" | "rejected";
}
