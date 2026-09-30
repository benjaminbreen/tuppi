export interface Entity { class: string; sub?: string; count?: number; f?: Record<string, unknown>; ref?: string; label?: string }
export interface Atom { verb: string; act?: string; theme?: Entity; [role: string]: unknown }
export interface Schema { label: string; reading: string; boundary: string; slots: { id: string; role: string; optional?: boolean; binds?: string; why?: string; match: Record<string, unknown>[] }[] }
export const GRAMMAR: { verbs: Record<string, { gloss: string; effect: string; template: string }>; speechActs: Record<string, string>; objectClasses: Record<string, string>; schemas: Record<string, Schema>; arc: { why?: Record<string, string> } };
export const VERBS: typeof GRAMMAR.verbs;
export const SPEECH_ACTS: Record<string, string>;
export const OBJECT_CLASSES: Record<string, string>;
export const SCHEMAS: Record<string, Schema>;
export function validateAtom(atom: unknown, where?: string): string[];
export function atomSignature(atom: Atom): string;
export function atomFineSignature(atom: Atom): string;
export function entityLabel(value: unknown, options?: { adapted?: boolean; substitute?: unknown }): string;
export function realizeAtom(atom: Atom, options?: { adapted?: boolean; substitute?: unknown }): string;
