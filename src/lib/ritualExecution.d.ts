import type { SharedRitualRecipe } from './ritualShare';
export interface ExecutionStep {
  id: string; sourceId: string; kind: 'source' | 'composed'; unitId: string;
  carriesWish?: boolean; title?: string; replacesSource?: boolean; addressee?: string; speechFunction?: string;
  evidence?: { doc: string; paragraph: number; text: string; status: string; translator: string };
  instruction: string; words?: string; note?: string;
  requires?: string[]; establishes?: string[]; completes?: string[]; accompanies?: string;
}
export const EXECUTION_VERSION: number;
export const SPEECH_RULES: Record<string, { requires: string[]; comparison?: string }>;
export function compileRitualSteps(recipe: Pick<SharedRitualRecipe, 'items' | 'goal' | 'goalFrame'> & { mode: string | null; executionVersion?: number }): ExecutionStep[];
export function validateExecutionSteps(steps: ExecutionStep[]): string[];
