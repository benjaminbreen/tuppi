import { useEffect, useState } from "react";

export type State = "o" | "b" | "h" | "e"; // ok, broken (restored), half-broken, erased
export type Kind = "syl" | "sum" | "akk" | "det" | "num" | "corr";
export type Run = [string, State, Kind];
export type Cls = "plant" | "mineral" | "animal" | "food" | "deity" | "person" | "place";
export const SUBSTANCE_CLASSES = ["plant", "mineral", "animal", "food"] as const;
export type SubCls = (typeof SUBSTANCE_CLASSES)[number];

export interface Word {
  r: Run[];
  p: "o" | "p" | "b"; // preserved / partly / restored
  tr?: string;
  l?: string;
  g?: string;
  gd?: string;
  m?: string;
  c?: "e" | "1" | "a" | "f"; // editor-selected / single analysis / ambiguous / by written form
  alt?: [string, string][];
  k?: Cls;
  s?: string;
  lang?: string;
}
export interface Gap { gap: string }
export type Token = Word | Gap;
export const isGap = (t: Token): t is Gap => (t as Gap).gap !== undefined;

export interface Line { n: string; lg: string; cu: string; rule: 0 | 1 | 2; w: Token[] }

export interface DocMeta {
  id: string;
  docid: string;
  cth: string;
  group: string;
  pubs: string[];
  nlines: number;
  pres: number;
  period: "OS" | "MS" | "NS" | "LNS" | null;
  inv?: string | null;
  cthSub?: string | null;
  zeit?: string | null;
  find?: string | null;
  note?: string | null;
  project: string;
}
export interface Doc extends DocMeta { lines: Line[]; paras: [number, number, number][] }

export interface Group { id: string; label: string; blurb: string }
export interface Composition {
  cth: string;
  group: string;
  title: string;
  who: string;
  from: string;
  concern: string;
  docs: string[];
  nDocs: number;
  periods: Record<string, number>;
  nLines: number;
}
export interface Index {
  groups: Group[];
  compositions: Composition[];
  docs: DocMeta[];
  stats: { docs: number; lines: number; words: number; substances: number; lemmas: number; compositions: number; translated?: number; places?: number; corpusTablets?: number };
  built: string;
}
export interface Attestation { d: string; docid: string; cth: string; li: number; wi: number; n: string; left: string; kw: string; right: string; p: "o" | "p" | "b" }
export interface Substance {
  id: string;
  lemma: string;
  label: string;
  class: SubCls;
  glossDe: string;
  status: "identified" | "tentative" | "class-only" | "unglossed";
  n: number;
  nPreserved: number;
  forms: string[];
  docs: number;
  cth: Record<string, number>;
  att: Attestation[];
}
export interface LexEntry { lemma: string; g: string; gd: string; n: number; docs: number }
export interface Para { a: number; b: number; s: [SubCls, string][]; act: Record<string, number>; dei: number; lg: string[]; pres: number; nw: number }
export interface Fingerprint { id: string; cth: string; paras: Para[] }

const cache = new Map<string, Promise<unknown>>();
export function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`/data/${path}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return r.json();
      }),
    );
  }
  return cache.get(path) as Promise<T>;
}

export function useData<T>(path: string | null): { data: T | null; error: string | null } {
  const [state, set] = useState<{ data: T | null; error: string | null; path: string | null }>({ data: null, error: null, path: null });
  useEffect(() => {
    if (!path) return;
    let live = true;
    load<T>(path)
      .then((d) => live && set({ data: d, error: null, path }))
      .catch((e) => live && set({ data: null, error: String(e), path }));
    return () => {
      live = false;
    };
  }, [path]);
  return state.path === path ? { data: state.data, error: state.error } : { data: null, error: null };
}

export interface Translation {
  doc: string;
  status: string;
  translator: string;
  date: string;
  intro: string;
  sections: { from: number; to: number; title: string }[];
  paras: { p: number; en: string }[];
  compare: { label: string; url?: string }[];
}
export type TrIndex = Record<string, { status: string; paras: number }>;

export const useIndex = () => useData<Index>("index.json");
export const useTrIndex = () => useData<TrIndex>("tr/index.json");
export const useSubstances = () => useData<Substance[]>("substances.json");

export const CLASS_LABEL: Record<Cls, string> = {
  plant: "Plants",
  mineral: "Minerals & metals",
  animal: "Animal-derived",
  food: "Food & drink",
  deity: "Deity",
  person: "Person",
  place: "Place",
};
export const CLASS_SINGULAR: Record<Cls, string> = {
  plant: "plant",
  mineral: "mineral / metal",
  animal: "animal-derived",
  food: "food / drink",
  deity: "deity",
  person: "person",
  place: "place",
};
export const STATUS_LABEL = {
  identified: "Identified",
  tentative: "Tentative",
  "class-only": "Class only",
  unglossed: "Unglossed",
} as const;
export const STATUS_NOTE = {
  identified: "TLHdig gives a specific meaning",
  tentative: "meaning marked uncertain (?)",
  "class-only": "only a category is known, e.g. '(a plant)'",
  unglossed: "no gloss in TLHdig; mostly Babylonian plant names",
} as const;
export const PERIOD_LABEL: Record<string, string> = {
  OS: "Old script",
  MS: "Middle script",
  NS: "New script",
  LNS: "Late New script",
  "?": "Undated",
};
export const LANG_LABEL: Record<string, string> = {
  Hit: "Hittite", Luw: "Luwian", Hur: "Hurrian", Hat: "Hattic", Pal: "Palaic", Akk: "Akkadian", Sum: "Sumerian",
};

/** Translate German side labels of the TLHdig line numbers into English conventions. */
export function lineLabel(n: string): { piece: string | null; label: string } {
  const m = n.match(/\{€([^}]*)\}/);
  let s = n.replace(/\{€[^}]*\}/g, "").trim();
  s = s
    .replace(/\blk\. Kol\./g, "l. col.")
    .replace(/\br\. Kol\./g, "r. col.")
    .replace(/\bVs\./g, "obv.")
    .replace(/\bRs\./g, "rev.")
    .replace(/\blk\. Rd\./g, "l. edge")
    .replace(/\bu\. Rd\./g, "lo. edge")
    .replace(/\bo\. Rd\./g, "up. edge")
    .replace(/\bRd\./g, "edge");
  return { piece: m ? m[1] : null, label: s };
}

export function gapLabel(g: string): string {
  return g
    .replace(/Text bricht ab/g, "text breaks off")
    .replace(/(\S+) bricht ab/g, "$1 breaks off")
    .replace(/Vs\./g, "obv.")
    .replace(/Rs\./g, "rev.")
    .replace(/Rasur/g, "erasure")
    .replace(/unbeschriebene Zeilen?/g, "uninscribed line")
    .replace(/unbeschrieben/g, "uninscribed")
    .replace(/Kolophon/g, "colophon")
    .replace(/\(Zeichenspuren\)/g, "(traces of signs)")
    .replace(/Zeichen/g, "signs")
    .replace(/\(Bruch\)/g, "(break)")
    .replace(/\(verloren\)/g, "(lost)")
    .replace(/Lücke unbekannter Größe/g, "gap of unknown size")
    .replace(/Rest unbeschrieben/g, "rest uninscribed")
    .replace(/Vorderseite/g, "obverse")
    .replace(/Rückseite/g, "reverse")
    .replace(/in Exemplar/g, "in manuscript")
    .replace(/erhaltener Teil( der Zeile)? unbeschrieben/g, "preserved part uninscribed")
    .replace(/Rest der Zeile unbeschrieben/g, "rest of line uninscribed")
    .replace(/Randleiste/g, "ruled margin")
    .replace(/Spuren/g, "traces")
    .replace(/Ende/g, "end")
    .replace(/lk\. Kol\./g, "l. col.")
    .replace(/r\. Kol\./g, "r. col.");
}
