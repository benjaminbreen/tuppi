import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useIndex, useSubstances, type LexEntry } from "../lib/data";
import { ClassMark } from "./Marks";

/** Fold diacritics so "ashella" finds "Ašḫella" and "sipanti" finds "šipanti". */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ḫ/g, "h")
    .replace(/[šṣ]/g, "s")
    .replace(/ṭ/g, "t")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[₀-₉]/g, (d) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(d)))
    .replace(/[=\-.°()[\]⸢⸣]/g, "");
}

interface Hit { key: string; kind: string; label: string; sub: string; to: string; mark?: React.ReactNode; score: number }

export default function Search({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [on, setOn] = useState(0);
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const { data: idx } = useIndex();
  const { data: subs } = useSubstances();
  const { data: lex } = useData<LexEntry[]>("lexicon.json");

  useEffect(() => input.current?.focus(), []);

  const hits = useMemo<Hit[]>(() => {
    const f = fold(q.trim());
    if (!f) return [];
    const out: Hit[] = [];
    const sc = (hay: string) => {
      const h = fold(hay);
      if (h === f) return 3;
      if (h.startsWith(f)) return 2;
      if (h.includes(f)) return 1;
      return 0;
    };
    idx?.compositions.forEach((c) => {
      const s = Math.max(sc(c.title), sc(`cth ${c.cth}`), sc(c.cth), sc(c.who), sc(c.concern));
      if (s) out.push({ key: `c${c.cth}`, kind: "Texts", label: c.title, sub: `CTH ${c.cth} · ${c.nDocs} manuscripts`, to: `/cth/${c.cth}`, score: s + 0.5 });
    });
    idx?.docs.forEach((d) => {
      const s = Math.max(sc(d.docid), ...d.pubs.map(sc));
      if (s >= 1) out.push({ key: `d${d.id}`, kind: "Manuscripts", label: d.docid, sub: `CTH ${d.cth} · ${d.nlines} lines`, to: `/text/${d.id}`, score: s });
    });
    subs?.forEach((x) => {
      const s = Math.max(sc(x.label), sc(x.lemma), ...x.forms.map(sc));
      if (s)
        out.push({ key: `s${x.id}`, kind: "Substances", label: x.label, sub: `${x.lemma} · ${x.n}×`, to: `/substance/${encodeURIComponent(x.id)}`, mark: <ClassMark cls={x.class} />, score: s + 0.3 });
    });
    lex?.forEach((w) => {
      const s = Math.max(sc(w.lemma), sc(w.g));
      if (s >= 1) out.push({ key: `w${w.lemma}`, kind: "Words", label: w.lemma, sub: `${w.g || "—"} · ${w.n}×`, to: `/word/${encodeURIComponent(w.lemma)}`, score: s + Math.min(w.n, 50) / 200 });
    });
    const order = ["Texts", "Substances", "Words", "Manuscripts"];
    const byKind = order.map((k) => out.filter((h) => h.kind === k).sort((a, b) => b.score - a.score).slice(0, k === "Words" ? 8 : 6));
    return byKind.flat();
  }, [q, idx, subs, lex]);

  useEffect(() => setOn(0), [q]);

  const go = (h?: Hit) => {
    if (!h) return;
    nav(h.to);
    onClose();
  };

  let lastKind = "";
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          placeholder="Search — try ašḫella, plague, honey, KUB 9.31, šipant-"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOn((o) => Math.min(o + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOn((o) => Math.max(o - 1, 0));
            } else if (e.key === "Enter") go(hits[on]);
          }}
          aria-label="Search query"
        />
        <div className="res">
          {!q && <div className="empty">Diacritics are optional: <span className="mono">ashella</span> finds Ašḫella.</div>}
          {q && hits.length === 0 && <div className="empty">Nothing found for “{q}”.</div>}
          {hits.map((h, i) => {
            const head = h.kind !== lastKind ? <div className="sec label" key={`h${h.kind}`}>{h.kind}</div> : null;
            lastKind = h.kind;
            return (
              <div key={h.key}>
                {head}
                <div className={`it ${i === on ? "on" : ""}`} onMouseEnter={() => setOn(i)} onClick={() => go(h)} role="option" aria-selected={i === on}>
                  <span>{h.mark}</span>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span className={h.kind === "Words" ? "tx-i" : ""}>{h.label}</span> <span className="sub">{h.sub}</span>
                  </span>
                  <span className="mono faint">↵</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
