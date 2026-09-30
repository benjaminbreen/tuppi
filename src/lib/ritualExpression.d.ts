import type { ExecutionStep } from './ritualExecution';
export function ritualInterpretation(recipe: {mode: string | null; items: {id: string; episodeId?: string; grammarId?: string}[]}, steps: ExecutionStep[]): {title: string; explanation: string; sourceId?: string} | null;
