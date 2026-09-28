import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClassMark, PresBar } from "../components/Marks";
import { TranslitLine, WordForm, type TranslitOpts } from "../components/Translit";
import {
  CLASS_SINGULAR, LANG_LABEL, PERIOD_LABEL, isGap, lineLabel, useData, useIndex, useSubstances, useTrIndex, SUBSTANCE_CLASSES,
  type Doc, type Line, type SubCls, type Translation, type Word,
} from "../lib/data";

type View = "parallel" | "english" | "lines";
function useView(): [View, (v: View) => void] {
  const [v, set] = useState<View>(() => {
    try {
      const s = localStorage.getItem("tuppi-view");
      return s === "english" || s === "lines" ? s : "parallel";
    } catch {
      return "parallel";
    }
  });
  return [
    v,
    (x: View) => {
      set(x);
      try {
        localStorage.setItem("tuppi-view", x);
      } catch {
        /* ignore */
      }
    },
  ];
}

/** English text with the translator's conventions made visible: [restored], […] lost, (?) doubt, [editorial notes]. */
export function TrText({ s }: { s: string }) {
  const parts = s.split(/(\[[^\]]*\]|\(\?\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p === "(?)") return <span key={i} className="q">(?)</span>;
        if (p.startsWith("[")) {
          const inner = p.slice(1, -1);
          if (/^[…. ]+$/.test(inner)) return <span key={i} className="lost">[…]</span>;
          if (/^(Colophon|Luwian|Hurrian|Hattic|Akkadian|Sumerian|Palaic|—|Rest|Remainder|Traces|Gap|Break|Lines?\b|Several|A few|\w+ lines?)/i.test(inner) || inner.endsWith(":"))
            return <span key={i} className="ed">{inner}</span>;
          return <span key={i} className="rs"><span className="bk">[</span>{inner}<span className="bk">]</span></span>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function usePref(key: string, init: boolean): [boolean, (v: boolean) => void] {
  const [v, set] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(`tuppi-${key}`);
      return s === null ? init : s === "1";
    } catch {
      return init;
    }
  });
  return [
    v,
    (x: boolean) => {
      set(x);
      try {
        localStorage.setItem(`tuppi-${key}`, x ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
  ];
}

const CERT: Record<string, string> = {
  e: "Analysis selected by the TLHdig editors",
  "1": "The only analysis offered",
  a: "Ambiguous — TLHdig offers several analyses",
  f: "Not analysed here; matched by its written form to confirmed analyses elsewhere in TLHdig",
};
const PRES: Record<string, string> = { o: "Fully preserved on the tablet", p: "Partly restored by the editor", b: "Entirely restored by the editor" };

function Inspector({ w, line, onClose }: { w: Word | null; line: string | null; onClose?: () => void }) {
  const { data: subs } = useSubstances();
  if (!w)
    return (
      <div className="hint">
        <p className="label" style={{ marginBottom: 10 }}>How to read</p>
        <p>Select any word to see its dictionary form, English gloss, grammar and how much of it survives.</p>
        <p style={{ marginTop: 10 }}>
          <span className="tx-i">italic</span> Hittite and Akkadian syllables · <span className="tx">UPRIGHT</span> Sumerian word-signs ·
          superscripts are determinatives (<span className="tx">ᵈ</span> god, <span className="tx">ᵐ</span> man) ·{" "}
          <span style={{ color: "var(--restored)" }}>[grey in brackets]</span> is restored by the editor · a horizontal rule is the scribe’s own paragraph line.
        </p>
        <div className="legend" style={{ marginTop: 14 }}>
          {SUBSTANCE_CLASSES.map((c) => (
            <span key={c}><ClassMark cls={c} /> {CLASS_SINGULAR[c]}</span>
          ))}
        </div>
      </div>
    );
  const sub = w.s && subs ? subs.find((s) => s.id === w.s) : null;
  return (
    <div>
      {onClose && (
        <button className="iconbtn close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6"><path d="M2 2l10 10M12 2L2 12" /></svg>
        </button>
      )}
      <p className="label">{line ? lineLabel(line).label : "Word"}</p>
      <div className="form"><WordForm w={w} /></div>
      {w.tr && <p className="faint tx-i" style={{ fontSize: 15 }}>{w.tr}</p>}
      <dl className="kv">
        {w.l && (
          <>
            <dt>Lemma</dt>
            <dd>
              <Link className="link tx-i" to={`/word/${encodeURIComponent(w.l)}`}>{w.l}</Link>
            </dd>
          </>
        )}
        {w.g !== undefined && (
          <>
            <dt>Gloss</dt>
            <dd>
              <b style={{ fontWeight: 500 }}>{w.g || "—"}</b>
              {w.gd && w.gd !== w.g && <span className="faint" style={{ fontSize: 13 }}> · de. {w.gd}</span>}
            </dd>
          </>
        )}
        {w.m && (
          <>
            <dt>Grammar</dt>
            <dd className="mono" style={{ fontSize: 12, paddingTop: 2 }}>{w.m.replace(/[{}]/g, "").replace(/\s+/g, " ")}</dd>
          </>
        )}
        {w.c && (
          <>
            <dt>Analysis</dt>
            <dd style={{ fontSize: 13 }}>{CERT[w.c]}</dd>
          </>
        )}
        {w.alt && (
          <>
            <dt>Options</dt>
            <dd style={{ fontSize: 13 }}>
              {w.alt.map(([l, g], i) => (
                <div key={i}><span className="tx-i">{l}</span> <span className="faint">— {g || "?"}</span></div>
              ))}
            </dd>
          </>
        )}
        {!w.l && (
          <>
            <dt>Analysis</dt>
            <dd style={{ fontSize: 13 }} className="muted">{w.lang ? `${w.lang.toUpperCase()} word, not analysed in TLHdig` : "Not analysed in TLHdig"}</dd>
          </>
        )}
        <dt>Surface</dt>
        <dd style={{ fontSize: 13 }}>{PRES[w.p]}</dd>
        {w.k && (
          <>
            <dt>Type</dt>
            <dd>
              <span className="pill">
                {(SUBSTANCE_CLASSES as readonly string[]).includes(w.k) && <ClassMark cls={w.k as SubCls} />} {CLASS_SINGULAR[w.k]}
              </span>
            </dd>
          </>
        )}
      </dl>
      {w.k === "place" && w.l && (
        <Link to={`/map?l=${encodeURIComponent(w.l.replace(/^[①-⑳⓵-⓿ⓐ-ⓩⒶ-Ⓩ\s]+/, ""))}`} className="notice" style={{ display: "block", marginTop: 18 }}>
          Show on the map →
        </Link>
      )}
      {sub && (
        <Link to={`/substance/${encodeURIComponent(sub.id)}`} className="notice" style={{ display: "block", marginTop: 18 }}>
          <b style={{ color: "var(--ink)", fontWeight: 500 }}>{sub.label}</b> — {sub.n} occurrences in {sub.docs} manuscripts. Open in the ledger →
        </Link>
      )}
    </div>
  );
}

function LineRow({ L, li, target, cun, opts, sel, onSelect }: {
  L: Line; li: number; target: [number, number] | null; cun: boolean; opts: TranslitOpts;
  sel: [number, number] | null; onSelect: (li: number, wi: number) => void;
}) {
  const { piece, label } = lineLabel(L.n);
  const inTarget = target && li >= target[0] && li <= target[1];
  return (
    <div>
      <div className={`ln ${inTarget ? "hl" : ""}`} id={`L${li}`}>
        <div className="no" title={L.n}>
          {piece && <span className="pc">{piece}</span>}
          {label}
        </div>
        <div className="body">
          {cun && L.cu && <div className="cu" aria-hidden>{L.cu.replace(/▒+/g, " · ")}</div>}
          <div className="tl">
            <TranslitLine tokens={L.w} opts={opts} selected={sel && sel[0] === li ? sel[1] : null} onSelect={(wi) => onSelect(li, wi)} />
          </div>
        </div>
        <div className="lg" title={LANG_LABEL[L.lg] || L.lg}>{L.lg && L.lg !== "Hit" ? L.lg : ""}</div>
      </div>
      {L.rule === 1 && <div className="rule1" aria-hidden />}
      {L.rule === 2 && <div className="rule2" aria-hidden />}
    </div>
  );
}

function paraRange(doc: Doc, pi: number) {
  const [a, b] = doc.paras[pi];
  const la = lineLabel(doc.lines[a].n).label;
  const lb = lineLabel(doc.lines[b].n).label;
  if (la === lb) return la;
  // "obv. I 3′ – obv. I 9′" → "obv. I 3′–9′"
  const pa = la.split(" "), pb = lb.split(" ");
  let k = 0;
  while (k < pa.length - 1 && k < pb.length - 1 && pa[k] === pb[k]) k++;
  return `${la}–${pb.slice(k).join(" ")}`;
}

function TrNote({ tr }: { tr: Translation }) {
  return (
    <div className="trnote">
      <p className="intro">{tr.intro}</p>
      <p className="by">
        <span className="en-badge">Draft</span> English translation by {tr.translator.replace(/, draft,?/, ",")} ({tr.date}). It aims to say what the
        text says, paragraph by paragraph; it is not a substitute for the published editions
        {tr.compare.length ? ": " : "."}
        {tr.compare.map((c, i) => (
          <span key={i}>
            {i > 0 && "; "}
            {c.url ? <a className="link" href={c.url} target="_blank" rel="noreferrer">{c.label}</a> : c.label}
          </span>
        ))}
        {tr.compare.length ? "." : ""}
      </p>
    </div>
  );
}

export default function Reader() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const { data: doc, error } = useData<Doc>(`docs/${id}.json`);
  const { data: idx } = useIndex();
  const { data: trIdx } = useTrIndex();
  const hasTr = !!trIdx?.[id];
  const { data: tr } = useData<Translation>(hasTr ? `tr/${id}.json` : null);
  const [cun, setCun] = usePref("cun", false);
  const [brackets, setBrackets] = usePref("brackets", true);
  const [glosses, setGlosses] = usePref("glosses", false);
  const [hl, setHl] = usePref("hl", true);
  const [viewPref, setView] = useView();
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [target, setTarget] = useState<[number, number] | null>(null);
  const focusSub = sp.get("s");
  const view: View = tr ? viewPref : "lines";

  useEffect(() => setSel(null), [id]);

  useEffect(() => {
    if (!doc) return;
    const h = loc.hash;
    let range: [number, number] | null = null;
    if (h === "#L-last") range = [doc.lines.length - 7, doc.lines.length - 1];
    else if (/^#L\d+$/.test(h)) {
      const i = +h.slice(2);
      range = [i, i];
      const wi = sp.get("w");
      if (wi !== null) setSel([i, +wi]);
    } else if (/^#P\d+$/.test(h)) {
      const p = doc.paras[+h.slice(2)];
      if (p) range = [p[0], p[1]];
    }
    setTarget(range);
    if (range)
      requestAnimationFrame(() => {
        const r0 = Math.max(0, range![0]);
        const el = document.getElementById(`L${r0}`);
        if (el) return el.scrollIntoView({ block: "center" });
        const pi = doc.paras.findIndex(([a, b]) => r0 >= a && r0 <= b);
        document.getElementById(`T${pi}`)?.scrollIntoView({ block: "start" });
      });
  }, [doc, loc.hash, sp, view]);

  const comp = idx?.compositions.find((c) => c.cth === doc?.cth);
  const siblings = useMemo(() => (idx && comp ? comp.docs.map((d) => idx.docs.find((x) => x.id === d)!).filter(Boolean) : []), [idx, comp]);
  const trByP = useMemo(() => new Map((tr?.paras || []).map((p) => [p.p, p.en])), [tr]);
  const secByP = useMemo(() => new Map((tr?.sections || []).map((s) => [s.from, s.title])), [tr]);
  const opts: TranslitOpts = { brackets, glosses, highlight: hl, focusSubstance: focusSub };
  const selWord = sel && doc ? (doc.lines[sel[0]]?.w[sel[1]] as Word | undefined) : undefined;
  const selWordOk = selWord && !isGap(selWord) ? selWord : null;
  const onSelect = (li: number, wi: number) => setSel([li, wi]);

  if (error) return <div className="wrap page"><h1>Not found</h1><p className="muted">No manuscript “{id}”.</p></div>;
  if (!doc) return <div className="wrap loading">Loading…</div>;

  const translit = view !== "english";
  return (
    <div className={`wrap page ${view === "parallel" ? "wide" : ""}`}>
      <header style={{ display: "grid", gap: 10, marginBottom: 6 }}>
        <div className="crumbs">
          <Link to="/texts">Texts</Link><span className="sep">/</span>
          {comp && <><Link to={`/cth/${comp.cth}`}>CTH {comp.cth} · {comp.title}</Link><span className="sep">/</span></>}
          <span>{doc.docid}</span>
        </div>
        <h1 style={{ fontSize: "clamp(26px, 3.4vw, 36px)" }}>{doc.docid}</h1>
        <div className="docmeta">
          {doc.pubs.length > 1 && <span><span className="faint">Joined pieces </span><b>{doc.pubs.join(" + ")}</b></span>}
          <span><span className="faint">Script </span><b>{doc.period ? PERIOD_LABEL[doc.period] : "undated"}</b></span>
          {doc.cthSub && <span><span className="faint">Copy </span><b className="mono">CTH {doc.cthSub}</b></span>}
          <span><span className="faint">Preserved </span><PresBar v={doc.pres} /> <b className="mono">{Math.round(doc.pres * 100)}%</b></span>
          {doc.find && <span title={doc.find}><span className="faint">Found </span><b>{doc.find.split(":")[0]}</b></span>}
          <span>
            <a className="link" href={`https://hethport.net/TLHdig/tlh_xtx.php?d=${encodeURIComponent(doc.docid.replace(/\+$/, ""))}`} target="_blank" rel="noreferrer">TLHdig ↗</a>
          </span>
        </div>
        {tr && <TrNote tr={tr} />}
        {siblings.length > 1 && (
          <nav className="mstabs" aria-label="Other manuscripts of this composition">
            {siblings.map((s) => (
              <Link key={s.id} to={`/text/${s.id}${focusSub ? `?s=${encodeURIComponent(focusSub)}` : ""}`} className={s.id === doc.id ? "active" : ""}>
                {s.docid}<span className="mono">{s.nlines}</span>{trIdx?.[s.id] && <span className="en-dot" title="English translation available">EN</span>}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="tools" role="toolbar" aria-label="Display options">
        {tr && (
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === "parallel"} onClick={() => setView("parallel")}>Side by side</button>
            <button aria-pressed={view === "english"} onClick={() => setView("english")}>English</button>
            <button aria-pressed={view === "lines"} onClick={() => setView("lines")}>Transliteration</button>
          </div>
        )}
        {translit && (
          <>
            <label className="toggle"><input type="checkbox" checked={brackets} onChange={(e) => setBrackets(e.target.checked)} /> Brackets</label>
            <label className="toggle"><input type="checkbox" checked={glosses} onChange={(e) => setGlosses(e.target.checked)} /> Glosses</label>
            <label className="toggle"><input type="checkbox" checked={cun} onChange={(e) => setCun(e.target.checked)} /> Cuneiform</label>
            <label className="toggle"><input type="checkbox" checked={hl} onChange={(e) => setHl(e.target.checked)} /> Substances</label>
          </>
        )}
        {focusSub && translit && (
          <Link className="chip" aria-pressed="true" to={loc.pathname}>
            Focus: {focusSub.replace(/^[sw]:/, "")} <span aria-hidden>×</span>
          </Link>
        )}
      </div>

      {view === "lines" && (
        <div className="reader">
          <div className={`lines ${hl ? "" : "nohl"}`}>
            {doc.lines.map((L, li) => (
              <LineRow key={li} L={L} li={li} target={target} cun={cun} opts={opts} sel={sel} onSelect={onSelect} />
            ))}
          </div>
          <aside className="inspector" aria-live="polite">
            <Inspector w={selWordOk} line={sel ? doc.lines[sel[0]].n : null} />
          </aside>
        </div>
      )}

      {view === "parallel" && (
        <div className={`pview ${hl ? "" : "nohl"}`}>
          <div className="phead" aria-hidden>
            <span className="label">Transliteration</span>
            <span className="label">English (draft)</span>
          </div>
          {doc.paras.map(([a, b], pi) => (
            <div key={pi}>
              {secByP.has(pi) && <h2 className="sechead">{secByP.get(pi)}</h2>}
              <section className="prow" id={`T${pi}`}>
                <div className="pl">
                  {doc.lines.slice(a, b + 1).map((L, k) => (
                    <LineRow key={a + k} L={L} li={a + k} target={target} cun={cun} opts={opts} sel={sel} onSelect={onSelect} />
                  ))}
                </div>
                <div className="pr-en">
                  <span className="pno">§{pi + 1}</span>
                  <p><TrText s={trByP.get(pi) ?? "[not translated]"} /></p>
                </div>
              </section>
            </div>
          ))}
        </div>
      )}

      {view === "english" && (
        <article className="enread">
          {doc.paras.map((_, pi) => (
            <div key={pi}>
              {secByP.has(pi) && <h2 className="sechead">{secByP.get(pi)}</h2>}
              <div className={`epara ${target && doc.paras[pi][0] <= target[0] && target[0] <= doc.paras[pi][1] ? "hl" : ""}`} id={`T${pi}`}>
                <button className="pref" onClick={() => { setView("parallel"); nav(`${loc.pathname}${loc.search}#P${pi}`); }} title="Show beside the transliteration">
                  <span>§{pi + 1}</span>
                  <span className="rng">{paraRange(doc, pi)}</span>
                </button>
                <p><TrText s={trByP.get(pi) ?? "[not translated]"} /></p>
              </div>
            </div>
          ))}
        </article>
      )}

      {view !== "lines" && (
        <div className={`sheet float ${selWordOk ? "open" : ""}`} aria-hidden={!selWordOk}>
          <Inspector w={selWordOk} line={sel ? doc.lines[sel[0]].n : null} onClose={() => setSel(null)} />
        </div>
      )}
      {view === "lines" && (
        <div className={`sheet ${selWordOk ? "open" : ""}`} aria-hidden={!selWordOk}>
          <Inspector w={selWordOk} line={sel ? doc.lines[sel[0]].n : null} onClose={() => setSel(null)} />
        </div>
      )}
    </div>
  );
}
