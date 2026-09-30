import records from "../data/corpora.json";

export type CorpusStage = "candidate" | "audited" | "imported";
export type DateBasis = "corpus" | "composition" | "witness";
export interface DateRange {
  start: number;
  end: number;
  basis: DateBasis;
  precision: "exact" | "approximate";
}
export interface CorpusRecord {
  id: string;
  name: string;
  culture: string;
  languages: string[];
  scripts: string[];
  genres: string[];
  provider: string;
  sourceUrl: string;
  sourceVersion: string | null;
  rights: string;
  reuseStatus: "permitted" | "restricted" | "needs-review";
  rightsUrl: string;
  stage: CorpusStage;
  coverage: string;
  dateRange: DateRange | null;
  adapter: string;
  dataPath: string | null;
  metadataPath?: string;
}

/** Stable source IDs are namespaced so unrelated providers never share an identity. */
export const sourceKey = (corpusId: string, sourceId: string) => `${corpusId}:${sourceId}`;
export const CORPORA = records as CorpusRecord[];
export const corpusById = new Map(CORPORA.map((corpus) => [corpus.id, corpus]));

export function formatYear(year: number): string {
  return `${Math.abs(year)} ${year < 0 ? "BCE" : "CE"}`;
}

export function formatDateRange(range: DateRange | null): string {
  if (!range) return "Dates to audit";
  return `${range.precision === "approximate" ? "c. " : ""}${formatYear(range.start)}–${formatYear(range.end)} (${range.basis})`;
}
