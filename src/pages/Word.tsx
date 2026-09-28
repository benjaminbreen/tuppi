import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Kwic, { type KwicRow } from "../components/Kwic";
import { isGap, load, useData, type Doc, type LexEntry, type Token } from "../lib/data";

function plain(t: Token): string {
  if (isGap(t)) return "…";
  return t.r.map(([s, st]) => (st === "b" ? `[${s}]` : s)).join("").replace(/\]\[/g, "");
}

export default function WordPage() {
  const { lemma = "" } = useParams();
  const lem = decodeURIComponent(lemma);
  const { data: lex } = useData<LexEntry[]>("lexicon.json");
  const { data: refs } = useData<Record<string, [string, number, number][]>>("lexrefs.json");
  const [rows, setRows] = useState<KwicRow[] | null>(null);
  const entry = lex?.find((x) => x.lemma === lem);
  const myRefs = useMemo(() => (refs ? refs[lem] || [] : []), [refs, lem]);

  useEffect(() => {
    if (!refs) return;
    let live = true;
    const docs = Array.from(new Set(myRefs.map((r) => r[0]))).slice(0, 60);
    Promise.all(docs.map((d) => load<Doc>(`docs/${d}.json`))).then((ds) => {
      if (!live) return;
      const byId = new Map(ds.map((d) => [d.id, d]));
      const out: KwicRow[] = [];
      for (const [d, li, wi] of myRefs) {
        const D = byId.get(d);
        if (!D) continue;
        const w = D.lines[li].w;
        out.push({ d, docid: D.docid, li, wi, n: D.lines[li].n, left: w.slice(Math.max(0, wi - 4), wi).map(plain).join(" "), kw: plain(w[wi]), right: w.slice(wi + 1, wi + 5).map(plain).join(" ") });
      }
      setRows(out);
    });
    return () => {
      live = false;
    };
  }, [refs, myRefs]);

  return (
    <div className="wrap page">
      <header className="pagehead">
        <div className="crumbs"><span>Words</span></div>
        <h1 className="tx-i" style={{ fontWeight: 400, letterSpacing: 0 }}>{lem}</h1>
        {entry && (
          <div className="docmeta">
            <span><span className="faint">Gloss </span><b>{entry.g || "—"}</b>{entry.gd && entry.gd !== entry.g && <span className="faint"> · de. {entry.gd}</span>}</span>
            <span><span className="faint">Occurrences </span><b className="mono">{entry.n}</b></span>
            <span><span className="faint">Manuscripts </span><b className="mono">{entry.docs}</b></span>
          </div>
        )}
      </header>
      {!rows ? <p className="loading">Loading concordance…</p> : <Kwic rows={rows} />}
      {rows && myRefs.length >= 400 && <p className="faint" style={{ marginTop: 12 }}>Showing the first 400 occurrences.</p>}
      <p style={{ marginTop: 28 }}><Link className="link" to="/substances">Browse the substance ledger →</Link></p>
    </div>
  );
}
