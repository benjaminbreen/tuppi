export type SharedRitualRecipe = {
  goal: string;
  mode: "historical" | "analogy" | "preview" | "custom";
  fit: "historical" | "clear" | "loose";
  items: { id: string; unitId: string; reason: "matched" | "prerequisite" | "manual"; jevProbability?: number }[];
};
export function encodeRitualRecipe(recipe: SharedRitualRecipe): string;
export function decodeRitualRecipe(token: string): SharedRitualRecipe;
