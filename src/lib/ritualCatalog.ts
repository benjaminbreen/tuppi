import catalog from "../data/rituals/catalog.json";

/** One catalogue record per edition, kept separate from the full step data. */
export interface RitualCatalogEntry {
  id: string;
  path: string;
  title: string;
  corpusId: "tlhdig-hittite" | "cmawro";
  cth: number | null;
  sourceLabel: string;
  concern: string;
  region: string;
  tags: string[];
  sources: string;
  description: string;
  images: string[];
  stepCount: number;
  searchTerms: string[];
}

type CatalogSourceEntry = Omit<RitualCatalogEntry, "corpusId" | "sourceLabel"> & Partial<Pick<RitualCatalogEntry, "corpusId" | "sourceLabel">>;
export const RITUAL_CATALOG: RitualCatalogEntry[] = (catalog as CatalogSourceEntry[]).map((entry) => ({
  ...entry,
  corpusId: entry.corpusId === "cmawro" ? "cmawro" as const : "tlhdig-hittite" as const,
  sourceLabel: entry.sourceLabel ?? `CTH ${entry.cth}`,
}));

export const RITUAL_CONCERNS = [...new Set(RITUAL_CATALOG.map((ritual) => ritual.concern))].sort();
