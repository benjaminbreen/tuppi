import catalog from "../data/rituals/catalog.json";

/** One catalogue record per edition, kept separate from the full step data. */
export interface RitualCatalogEntry {
  id: string;
  path: string;
  title: string;
  cth: number;
  concern: string;
  region: string;
  tags: string[];
  sources: string;
  description: string;
  images: string[];
  stepCount: number;
  searchTerms: string[];
}

export const RITUAL_CATALOG: RitualCatalogEntry[] = catalog;

export const RITUAL_CONCERNS = [...new Set(RITUAL_CATALOG.map((ritual) => ritual.concern))].sort();
