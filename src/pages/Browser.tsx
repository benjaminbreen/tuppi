import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClassMark } from "../components/Marks";
import {
  CLASS_LABEL, LANG_LABEL, SUBSTANCE_CLASSES, lineLabel, useData, useIndex, useSubstances,
  type Fingerprint, type Para, type Substance, type SubCls,
} from "../lib/data";

interface Tip { x: number; y: number; body: React.ReactNode }
const ACT_LABEL: Record<string, string> = { prepare: "preparation", apply: "application", offer: "offering / disposal", speak: "speech" };

function Strip({ fp, docid, subIdx, focus, onTip, onOpen }: {
  fp: Fingerprint; docid: string; subIdx: Map<string, Substance>; focus: string | null;
  onTip: (t: Tip | null) => void; onOpen: (pi: number) => void;
}) {
  const total = fp.paras.reduce((a, p) => a + Math.max(p.nw, 3), 0);
  return (
    <div className="strip" role="list" aria-label={`Paragraphs of ${docid}`}>
      {fp.paras.map((p: Para, pi) => {
        const grow = Math.max(p.nw, 3) / total;
        const names = new Map<string, number>();
        p.s.forEach(([, id]) => names.set(id, (names.get(id) || 0) + 1));
        return (
          <div
            key={pi}
            role="listitem"
            className={`para ${p.lg.length ? "lang" : ""}`}
            style={{ flexGrow: grow, flexBasis: 0 }}
            onMouseMove={(e) =>
              onTip({
                x: e.clientX, y: e.clientY,
                body: (
                  <>
                    <div className="h">{docid} · paragraph {pi + 1}</div>
                    <div className="faint mono" style={{ marginBottom: 6 }}>{p.nw} words · {Math.round(p.pres * 100)}% preserved{p.lg.length ? ` · ${p.lg.map((l) => LANG_LABEL[l] || l).join(", ")}` : ""}</div>
                    {[...names.entries()].slice(0, 8).map(([id, n]) => {
                      const s = subIdx.get(id);
                      return s ? <div className="row" key={id}><ClassMark cls={s.class} /> {s.label}{n > 1 ? ` ×${n}` : ""}</div> : null;
                    })}
                    {names.size > 8 && <div className="faint">+{names.size - 8} more</div>}
                    {Object.keys(p.act).length > 0 && <div className="faint" style={{ marginTop: 4 }}>{Object.entries(p.act).map(([k, v]) => `${ACT_LABEL[k] || k} ${v}`).join(" · ")}</div>}
                    {p.dei > 0 && <div className="faint">{p.dei} divine name{p.dei > 1 ? "s" : ""}</div>}
                  </>
                ),
              })
            }
            onMouseLeave={() => onTip(null)}
            onClick={() => onOpen(pi)}
          >
            {p.s.map(([cls, id], k) => (
              <ClassMark key={k} cls={cls} size={8} faded={!!focus && id !== focus} />
            ))}
            <i className="pr" style={{ width: `${p.pres * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function binOf(n: number) {
  return n === 0 ? 0 : n === 1 ? 2 : n <= 3 ? 3 : n <= 7 ? 4 : n <= 15 ? 5 : 6;
}

function Matrix({ subs, onTip }: { subs: Substance[]; onTip: (t: Tip | null) => void }) {
  const { data: idx } = useIndex();
  const nav = useNavigate();
  const cols = useMemo(() => {
    const out: Substance[] = [];
    for (const c of SUBSTANCE_CLASSES) out.push(...subs.filter((s) => s.class === c).sort((a, b) => b.n - a.n).slice(0, c === "plant" ? 16 : 10));
    return out;
  }, [subs]);
  if (!idx) return null;
  return (
    <div className="matrix">
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="faint">Occurrences per composition:</span>
        {[["1", 2], ["2–3", 3], ["4–7", 4], ["8–15", 5], ["16+", 6]].map(([l, b]) => (
          <span key={l as string}><i style={{ background: `var(--seq-${b})` }} /> {l}</span>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th />
            {cols.map((s) => (
              <th key={s.id} className="col" scope="col">
                <div><ClassMark cls={s.class} size={8} /> {s.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {idx.compositions.map((c) => (
            <tr key={c.cth}>
              <th className="row" scope="row"><Link to={`/cth/${c.cth}`}>{c.title}</Link></th>
              {cols.map((s) => {
                const n = s.cth[c.cth] || 0;
                const b = binOf(n);
                return (
                  <td
                    key={s.id}
                    style={{ background: b ? `var(--seq-${b})` : undefined }}
                    onMouseMove={(e) => onTip({ x: e.clientX, y: e.clientY, body: <><div className="h">{s.label}</div><div className="faint">{c.title}</div><div className="mono">{n} occurrence{n === 1 ? "" : "s"}</div></> })}
                    onMouseLeave={() => onTip(null)}
                    onClick={() => nav(`/substance/${encodeURIComponent(s.id)}`)}
                    aria-label={`${s.label} in ${c.title}: ${n}`}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Browser() {
  const { data: idx } = useIndex();
  const { data: subs } = useSubstances();
  const { data: fps } = useData<Fingerprint[]>("fingerprints.json");
  const nav = useNavigate();
  const [mode, setMode] = useState<"strips" | "matrix">("strips");
  const [group, setGroup] = useState<string | null>(null);
  const [minLines, setMinLines] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const subIdx = useMemo(() => new Map((subs || []).map((s) => [s.id, s])), [subs]);
  const fpIdx = useMemo(() => new Map((fps || []).map((f) => [f.id, f])), [fps]);

  if (!idx || !subs || !fps) return <div className="wrap loading">Loading…</div>;
  const focusSub = focus ? subIdx.get(focus) : null;
  return (
    <div className="wrap page" onMouseLeave={() => setTip(null)}>
      <header className="pagehead">
        <h1>Browser</h1>
        <p className="lede">
          {mode === "strips"
            ? "Each manuscript as a strip of its paragraphs, width proportional to length. Marks show substances in reading order; hatching marks passages in Luwian, Hurrian, Hattic or Akkadian; the thin line under each block is how much survives. Click a block to read it."
            : "Compositions against the most frequent substances of each class: a comparative pharmacopoeia at a glance. Darker cells mean more occurrences across all manuscripts of a composition. Click a cell to open the substance."}
        </p>
        <div className="bar" style={{ marginTop: 8 }}>
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={mode === "strips"} onClick={() => setMode("strips")}>Strips</button>
            <button aria-pressed={mode === "matrix"} onClick={() => setMode("matrix")}>Matrix</button>
          </div>
          {mode === "strips" && (
            <>
              <select className="field" style={{ minWidth: 0, width: "auto" }} value={group ?? ""} onChange={(e) => setGroup(e.target.value || null)} aria-label="Group">
                <option value="">All groups</option>
                {idx.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
              <select className="field" style={{ minWidth: 0, width: "auto" }} value={focus ?? ""} onChange={(e) => setFocus(e.target.value || null)} aria-label="Highlight a substance">
                <option value="">Highlight a substance…</option>
                {SUBSTANCE_CLASSES.map((c) => (
                  <optgroup key={c} label={CLASS_LABEL[c]}>
                    {subs.filter((s) => s.class === c && s.n >= 2).sort((a, b) => a.label.localeCompare(b.label)).map((s) => (
                      <option key={s.id} value={s.id}>{s.label} ({s.n})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <label className="toggle"><input type="checkbox" checked={minLines} onChange={(e) => setMinLines(e.target.checked)} /> Hide fragments under 12 lines</label>
            </>
          )}
        </div>
        <div className="legend" style={{ marginTop: 4 }}>
          {SUBSTANCE_CLASSES.map((c: SubCls) => <span key={c}><ClassMark cls={c} /> {CLASS_LABEL[c]}</span>)}
          {focusSub && <span><b style={{ fontWeight: 500 }}>Highlighting:</b> {focusSub.label} ({focusSub.n})</span>}
        </div>
      </header>

      {mode === "matrix" ? (
        <Matrix subs={subs} onTip={setTip} />
      ) : (
        <div className="fp">
          {idx.groups.filter((g) => !group || g.id === group).map((g) =>
            idx.compositions.filter((c) => c.group === g.id).map((c) => {
              const docs = c.docs.map((id) => idx.docs.find((d) => d.id === id)!).filter((d) => d && (!minLines || d.nlines >= 12));
              if (!docs.length) return null;
              return (
                <div key={c.cth} style={{ display: "contents" }}>
                  <div className="comphead">
                    <span className="mono faint">CTH {c.cth}</span>
                    <Link to={`/cth/${c.cth}`} style={{ fontWeight: 500 }}>{c.title}</Link>
                    <span className="faint" style={{ fontSize: 13 }}>{c.who}</span>
                  </div>
                  {docs.map((d) => {
                    const fp = fpIdx.get(d.id);
                    if (!fp) return null;
                    const hasFocus = focus ? fp.paras.some((p) => p.s.some(([, id]) => id === focus)) : true;
                    return (
                      <div key={d.id} style={{ display: "contents", opacity: hasFocus ? 1 : 0.35 }}>
                        <Link to={`/text/${d.id}`} className="lbl" title={d.docid} style={{ opacity: hasFocus ? 1 : 0.4 }}>
                          {d.docid}<span className="mono">{d.nlines}</span>
                        </Link>
                        <div style={{ opacity: hasFocus ? 1 : 0.4 }}>
                          <Strip fp={fp} docid={d.docid} subIdx={subIdx} focus={focus} onTip={setTip}
                            onOpen={(pi) => nav(`/text/${d.id}${focus ? `?s=${encodeURIComponent(focus)}` : ""}#P${pi}`)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }),
          )}
        </div>
      )}
      {tip && (
        <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 340), top: tip.y + 14 }} role="tooltip">
          {tip.body}
        </div>
      )}
      <p className="faint" style={{ marginTop: 28, fontSize: 13 }}>
        Line ranges follow the tablet’s own paragraph rulings; {lineLabel("Vs. I 1").label} = obverse, column I, line 1.
      </p>
    </div>
  );
}
