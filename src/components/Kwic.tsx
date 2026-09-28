import { Link } from "react-router-dom";
import { lineLabel } from "../lib/data";

export interface KwicRow { d: string; docid: string; li: number; wi: number; n: string; left: string; kw: string; right: string; p?: string }

/** Keyword-in-context concordance. Restored text keeps its brackets and is greyed. */
function Tx({ s: raw }: { s: string }) {
  const s = raw.replace(/[\u2329\u3008]/g, "⟨").replace(/[\u232A\u3009]/g, "⟩");
  const parts = s.split(/(\[[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("[") ? <span key={i} className="restored">{p}</span> : <span key={i}>{p}</span>))}
    </>
  );
}

export default function Kwic({ rows, focus }: { rows: KwicRow[]; focus?: string }) {
  return (
    <div className="kwic" role="list">
      {rows.map((r, i) => (
        <Link key={i} to={`/text/${r.d}?${focus ? `s=${encodeURIComponent(focus)}&` : ""}w=${r.wi}#L${r.li}`} role="listitem">
          <span className="l"><bdi><Tx s={r.left} /></bdi></span>
          <span className="k"><Tx s={r.kw} /></span>
          <span className="r"><Tx s={r.right} /></span>
          <span className="s">{r.docid} · {lineLabel(r.n).label}</span>
        </Link>
      ))}
    </div>
  );
}
