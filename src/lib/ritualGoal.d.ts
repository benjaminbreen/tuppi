export interface GoalFrame { outcome: string; wish: string; method: 'template' | 'luna'; relationship?: { person: string; kind: 'reconciliation' | 'cooperation' | 'care' | 'other' }; title?: string; prayer?: string; unwanted?: string }
export function normalizeGoalFrame(value: unknown): GoalFrame;
export function proceduralGoalFrame(goal: string): GoalFrame | null;
export function goalWordingFor(item: { id: string; episodeId?: string; grammarId?: string }, frame?: GoalFrame | null): { instruction: string; words: string; note: string } | null;
