import type { GoalFrame } from "./ritualGoal";
export interface Episode { id: string; ritualId: string; stepIds: string[]; title: string; role: string; stage: number; themes: string[]; historicalLogic: string; adaptation: string; instructions: Record<string, string>; supports?: string; resources: { id: string; introducedAt: string; usedAt: string[]; completedAt: string }[] }
export interface ActionChain { id: string; ritualId: string; stepIds: string[]; role: string; stage: number; themes: string[]; historicalOnly: boolean; historicalLogic: string; adaptation: string }
export interface SemanticItem { id: string; episodeId?: string; grammarId?: string; matchedTheme?: string }
export const MAX_RECIPE_STEPS: number;
export const EPISODES: Episode[];
export const ACTION_CHAINS: ActionChain[];
export const actionChainById: Map<string, ActionChain>;
export const THEMES: Record<string, { label: string; reading: string; boundary: string }>;
export const episodeById: Map<string, Episode>;
export function episodeStepIds(episode: Episode): string[];
export function validateEpisodePlan(items: SemanticItem[]): string[];
export function instructionFor(item: SemanticItem, adapted?: boolean, goalFrame?: GoalFrame | null): string;
export function connectionFor(item: SemanticItem): string;
