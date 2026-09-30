import type { Atom, Entity } from './ritualAtoms';
export interface AtomRecord { id: string; ritualId: string; ritualName: string; corpusId: string; sourceLabel: string; region: string | null; stepId: string; stepNumber: number; atomIndex: number; unitId: string; stepTitle: string; aims: string[]; function: string; recipient: string | null; deityVisualId: string | null; signature: string; atom: Atom }
export interface PlanItem { atomId: string; schema: string; slot: string; role?: string; reason: 'slot' | 'requires' | 'dispose' | 'arc' | 'manual'; substitute?: { from?: string; to?: Entity; boundary?: Entity }; gather?: Entity[]; jevProbability?: number; words?: string; jevActionScore?: number }
export interface Plan { seed: number; mode: string; cores: { id: string; p: number }[]; items: PlanItem[]; score: number; unmet: number; leftCharged: number; attested?: string }
export const ATOMS: AtomRecord[];
export const atomById: Map<string, AtomRecord>;
export const SCHEMA_IDS: string[];
export function proposeRituals(options: { schemaScores: Record<string, number>; aimScores?: Record<string, number>; seed?: number; mode?: string; samples?: number; keep?: number; maxCores?: number; actionScores?: Record<string, number> | null }): { mode: string; schemaScores: Record<string, number>; plans: Plan[] };
export function validatePlanItems(items: PlanItem[]): string[];
