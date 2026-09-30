import type { GoalFrame } from './ritualGoal';
import type { PlanItem } from './ritualPlanner';
import type { Schema } from './ritualAtoms';
export interface Provenance { ritualId: string; ritualName: string; sourceLabel: string; corpusId: string; region: string | null; stepId: string; stepNumber: number; stepTitle: string }
export interface GrammarCard {
  id: string; kind: 'source' | 'composed'; sourceId: string; atomIds: string[]; unitId: string; instruction: string;
  title?: string; words?: string; speechFunction?: string; carriesWish?: boolean; addressee?: string; note?: string;
  evidence: { text: string; original: boolean; locus: string; source: unknown } | null; provenance: Provenance;
  seam: { from: string; to: string; acrossTraditions: boolean } | null; recombined?: boolean; insetUnitId?: string; schema: string; slot: string; reason: string; notes: string[];
}
export const GRAMMAR_EXECUTION_VERSION: number;
export function compileGrammarSteps(recipe: { goal: string; goalFrame?: GoalFrame | null; mode: string | null; items: PlanItem[] }): GrammarCard[];
export function describePlan(recipe: { items: PlanItem[] }, schemas: Record<string, Schema>): { title: string; explanation: string; rituals: string[]; crossesTraditions: boolean };
