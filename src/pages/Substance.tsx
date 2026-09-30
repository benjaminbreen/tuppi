import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Kwic from "../components/Kwic";
import { ClassMark } from "../components/Marks";
import { CLASS_SINGULAR, STATUS_LABEL, STATUS_NOTE, useIndex, useSubstances } from "../lib/data";

export default function SubstancePage() {
  const { id = "" } = useParams();
  const sid = decodeURIComponent(id);
  const { data: subs } = useSubstances();
  const { data: idx } = useIndex();
  const [onlyPreserved, setOnlyPreserved] = useState(false);
  const s = subs?.find((x) => x.id === sid);
  const byComp = useMemo(() => {
    if (!s || !idx) return [];
    return Object.entries(s.cth)
      .map(([cth, n]) => ({ cth, n, c: idx.compositions.find((c) => c.cth === cth) }))
      .sort((a, b) => b.n - a.n);
  }, [s, idx]);
  if (!subs || !idx) return <div className="wrap loading">Loading…</div>;
  if (!s) return <div className="wrap page"><h1>Unknown substance</h1></div>;
  const max = Math.max(...byComp.map((x) => x.n));
  const rows = onlyPreserved ? s.att.filter((a) => a.p !== "b") : s.att;
  return (
    <div className="wrap page">
      <header className="pagehead">
        <div className="crumbs"><Link to="/substances">Substances</Link><span className="sep">/</span><span>{CLASS_SINGULAR[s.class]}</span></div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 14 }}><ClassMark cls={s.class} size={16} /> {s.label}</h1>
        <div className="docmeta">
          <span><span className="faint">Lemma </span><b className="tx-i" style={{ fontSize: 17 }}>{s.lemma}</b></span>
          <span><span className="faint">Written </span><b className="tx">{s.forms.join(", ")}</b></span>
          <span><span className={`status ${s.status}`}>{STATUS_LABEL[s.status]}</span> <span className="faint">— {STATUS_NOTE[s.status]}</span></span>
          {s.glossDe && <span><span className="faint">TLHdig gloss </span><b>{s.glossDe}</b></span>}
          {s.cmawro && <span><span className="faint">CMAwRo </span><b className="tx-i">{s.cmawro.akkadian}</b> “{s.cmawro.gloss}” <span className="faint">· matched by {s.cmawro.basis} · {s.cmawro.n} attestations in {s.cmawro.texts} texts</span>{s.cmawro.example && <> · <Link to={`/corpora/cmawro/text/${s.cmawro.example.text}#${encodeURIComponent(s.cmawro.example.ref)}`}>example ↗</Link></>}</span>}
        </div>
      </header>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ marginBottom: 12 }}>Where it occurs</h2>
        <div className="hbars">
          {byComp.map(({ cth, n, c }) => (
            <Link to={`/cth/${cth}`} className="hb" key={cth}>
              <span className="t"><span className="mono faint">CTH {cth}</span> {c?.title}</span>
              <span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="mono faint r">{n}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="bar" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <h2>Concordance <span className="mono faint" style={{ fontWeight: 400 }}>{rows.length}</span></h2>
          <label className="toggle"><input type="checkbox" checked={onlyPreserved} onChange={(e) => setOnlyPreserved(e.target.checked)} /> Only where the word survives on the clay</label>
        </div>
        <Kwic rows={rows} focus={s.id} />
      </section>
    </div>
  );
}
