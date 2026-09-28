import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PeriodDots } from "../components/Marks";
import { fold } from "../components/Search";
import { useIndex, useTrIndex } from "../lib/data";

export default function Texts() {
  const { data: idx } = useIndex();
  const { data: tr } = useTrIndex();
  const [q, setQ] = useState("");
  const [onlyTr, setOnlyTr] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const loc = useLocation();

  useEffect(() => {
    if (loc.hash && idx) {
      const el = document.getElementById(loc.hash.slice(1));
      el?.scrollIntoView({ block: "start" });
    }
  }, [loc.hash, idx]);

  const comps = useMemo(() => {
    if (!idx) return [];
    const f = fold(q);
    return idx.compositions.filter(
      (c) =>
        (!group || c.group === group) &&
        (!onlyTr || c.docs.some((d) => tr?.[d])) &&
        (!f || fold(`${c.title} ${c.who} ${c.from} ${c.concern} cth ${c.cth}`).includes(f)),
    );
  }, [idx, q, group, onlyTr, tr]);
  const nTr = tr ? Object.keys(tr).length : 0;

  if (!idx) return <div className="wrap loading">Loading…</div>;
  return (
    <div className="wrap page">
      <header className="pagehead">
        <h1>Texts</h1>
        <p className="lede">
          {idx.stats.compositions} compositions in {idx.stats.docs} manuscripts. The bars show how many copies survive in each
          script period (Old, Middle, New, late New) — the date of the copy, not of the composition.
          {nTr > 0 && <> {nTr} manuscripts have a draft English translation, marked <span className="en-badge">EN</span>.</>}
        </p>
        <div className="bar" style={{ marginTop: 8 }}>
          <input className="field" placeholder="Filter by title, practitioner, place, concern…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter texts" />
          <div className="chips" role="group" aria-label="Group">
            <button className="chip" aria-pressed={group === null} onClick={() => setGroup(null)}>All</button>
            <button className="chip" aria-pressed={onlyTr} onClick={() => setOnlyTr(!onlyTr)}>Translated</button>
            {idx.groups.map((g) => (
              <button key={g.id} className="chip" aria-pressed={group === g.id} onClick={() => setGroup(group === g.id ? null : g.id)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {idx.groups.map((g) => {
        const cs = comps.filter((c) => c.group === g.id);
        if (!cs.length) return null;
        return (
          <section key={g.id} id={g.id} style={{ scrollMarginTop: 80 }}>
            <div className="gh">
              <h2>{g.label}</h2>
              <p>{g.blurb}</p>
            </div>
            {cs.map((c) => (
              <Link key={c.cth} to={`/cth/${c.cth}`} className="comp">
                <span className="cth">CTH {c.cth}</span>
                <span>
                  <span className="t">{c.title}</span>
                  {c.docs.some((d) => tr?.[d]) && (
                    <span className="en-badge" style={{ marginLeft: 8 }} title="Draft English translation available">
                      EN {c.docs.filter((d) => tr?.[d]).length}
                    </span>
                  )}
                  <br />
                  <span className="who">{[c.who, c.from].filter(Boolean).join(" · ") || "—"}{c.concern ? ` — ${c.concern}` : ""}</span>
                </span>
                <span className="c3 mono faint">{c.nDocs} {c.nDocs === 1 ? "manuscript" : "manuscripts"}<br />{c.nLines.toLocaleString()} lines</span>
                <span className="c4"><PeriodDots periods={c.periods} /></span>
              </Link>
            ))}
          </section>
        );
      })}
      {comps.length === 0 && <p className="muted" style={{ marginTop: 24 }}>No texts match.</p>}
    </div>
  );
}
