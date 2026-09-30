import type { GoalFrame } from "./ritualGoal";
export type SharedRitualRecipe = {
  goal: string;
  executionVersion?: number;
  goalFrame?: GoalFrame;
  mode: "historical" | "analogy" | "preview" | "custom";
  fit: "historical" | "clear" | "loose";
  items: { id: string; unitId: string; reason: "matched" | "prerequisite" | "manual"; episodeId?: string; grammarId?: string; matchedTheme?: string; jevProbability?: number }[];
};
export function encodeRitualRecipe(recipe: SharedRitualRecipe): string;
export function decodeRitualRecipe(token: string): SharedRitualRecipe;
import type { PlanItem } from "./ritualPlanner";
export type GrammarRecipe = { engine: "grammar"; executionVersion: 7; goal: string; goalFrame?: GoalFrame; mode: "historical" | "analogy" | "preview" | "custom"; fit: "historical" | "clear" | "loose"; items: PlanItem[] };
export function encodeGrammarRecipe(recipe: Omit<GrammarRecipe, "engine" | "executionVersion">): string;
export function decodeAnyRitualRecipe(token: string): SharedRitualRecipe | GrammarRecipe;
