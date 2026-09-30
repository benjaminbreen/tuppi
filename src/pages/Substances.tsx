import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClassMark } from "../components/Marks";
import { fold } from "../components/Search";
import {
  CLASS_LABEL, STATUS_LABEL, STATUS_NOTE, SUBSTANCE_CLASSES, useIndex, useSubstances, type SubCls, type Substance,
} from "../lib/data";

const STATUSES = ["identified", "tentative", "class-only", "cmawro", "unglossed"] as const;
// CMAwRo glosses come from another corpus, so they get a distinct hue rather than a step on the scale.
const statusColor = (s: string) => s === "cmawro" ? "var(--mineral)" : `var(--ord-${["identified", "tentative", "class-only", "unglossed"].indexOf(s) + 1})`;
type Status = (typeof STATUSES)[number];

// Clicking a segment filters the table to that class and status; notes live in
// tooltips rather than on the page.
function StatusChart({ subs, onPick, active }: { subs: Substance[]; onPick: (cls: SubCls | null, st: Status | null) => void; active: { cls: SubCls | null; st: Status | null } }) {
  const rows = SUBSTANCE_CLASSES.map((c) => {
    const s = subs.filter((x) => x.class === c);
    const counts = Object.fromEntries(STATUSES.map((st) => [st, s.filter((x) => x.status === st).length])) as Record<Status, number>;
    return { key: c, counts, total: s.length };
  });
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div className="statusbar" aria-label="Identification status by class">
      <div className="legend" role="list">
        {STATUSES.map((s) => (
          <button type="button" key={s} role="listitem" title={STATUS_NOTE[s]} aria-pressed={active.st === s && !active.cls} onClick={() => onPick(null, active.st === s && !active.cls ? null : s)}>
            <i style={{ background: statusColor(s) }} /> {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {rows.map((r) => (
        <div className="sbrow" key={r.key}>
          <button type="button" className="sbrow-label" onClick={() => onPick(active.cls === r.key && !active.st ? null : r.key, null)}><ClassMark cls={r.key} /> {CLASS_LABEL[r.key]}</button>
          <span className="sbar" style={{ width: `${(r.total / max) * 100}%` }}>
            {STATUSES.map((s) =>
              r.counts[s] ? (
                <button
                  type="button"
                  key={s}
                  className={active.cls === r.key && active.st === s ? "on" : ""}
                  style={{ width: `${(r.counts[s] / r.total) * 100}%`, background: statusColor(s) }}
                  onClick={() => onPick(r.key, s)}
                  title={`${CLASS_LABEL[r.key]}: ${r.counts[s]} ${STATUS_LABEL[s].toLowerCase()}. Click to list them.`}
                  aria-label={`Show ${r.counts[s]} ${STATUS_LABEL[s].toLowerCase()} ${CLASS_LABEL[r.key].toLowerCase()}`}
                />
              ) : null,
            )}
          </span>
          <span className="mono faint r">{r.total}</span>
        </div>
      ))}
    </div>
  );
}

export default function Substances() {
  const { data: subs } = useSubstances();
  const { data: idx } = useIndex();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<SubCls | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [sort, setSort] = useState<"n" | "az" | "docs">("n");
  const [more, setMore] = useState(false);
  const [details, setDetails] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  function pick(c: SubCls | null, status: Status | null) {
    setCls(c); setSt(status); setGroup(null);
    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const groupOf = useMemo(() => {
    const m: Record<string, string> = {};
    idx?.compositions.forEach((c) => (m[c.cth] = c.group));
    return m;
  }, [idx]);

  const rows = useMemo(() => {
    if (!subs) return [];
    const f = fold(q);
    const r = subs.filter(
      (s) =>
        (!cls || s.class === cls) &&
        (!st || s.status === st) &&
        (!group || Object.keys(s.cth).some((c) => groupOf[c] === group)) &&
        (!f || fold(`${s.label} ${s.lemma} ${s.forms.join(" ")} ${s.glossDe}`).includes(f)),
    );
    return [...r].sort((a, b) => (sort === "az" ? a.label.localeCompare(b.label) : sort === "docs" ? b.docs - a.docs : b.n - a.n));
  }, [subs, q, cls, st, group, sort, groupOf]);

  if (!subs || !idx) return <div className="wrap loading">Loading…</div>;
  const unknown = subs.filter((s) => s.status !== "identified").length;
  return (
    <div className="wrap page">
      <header className="pagehead">
        <h1>Substances</h1>
        <p className="lede">
          {subs.length} terms for plants, minerals, animal products and foods in this slice, each with every attestation. {unknown} ({Math.round((unknown / subs.length) * 100)}%) are not securely identified.
        </p>
        <details className="substances-about">
          <summary>About identification</summary>
          <p>Plant names especially are known only as “(a plant)”, marked uncertain, or not glossed at all. {subs.filter((x) => x.status === "cmawro").length} Babylonian plant names that TLHdig leaves unglossed take their English from the CMAwRo edition of the same Akkadian word, matched by spelling or by a standard logogram equivalence.</p>
          <ul>{STATUSES.map((s) => <li key={s}><span className={`status ${s}`}>{STATUS_LABEL[s]}</span> — {STATUS_NOTE[s]}</li>)}</ul>
        </details>
      </header>

      <StatusChart subs={subs} onPick={pick} active={{ cls, st }} />

      <div className="bar" style={{ marginBottom: 14 }}>
        <input className="field" placeholder="Filter: honey, cedar, IN.NU.UŠ…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter substances" />
        <div className="chips" role="group" aria-label="Class">
          {SUBSTANCE_CLASSES.map((c) => (
            <button key={c} className="chip" aria-pressed={cls === c} onClick={() => setCls(cls === c ? null : c)}>
              <ClassMark cls={c} /> {CLASS_LABEL[c]} <span className="n">{subs.filter((s) => s.class === c).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="substances-tools">
        <span className="mono faint">{rows.length} shown{st ? ` · ${STATUS_LABEL[st].toLowerCase()}` : ""}</span>
        {(cls || st || group || q) && <button type="button" onClick={() => { setCls(null); setSt(null); setGroup(null); setQ(""); }}>Clear filters</button>}
        <button type="button" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Fewer filters" : "More filters"}</button>
        <button type="button" aria-pressed={details} onClick={() => setDetails(!details)}>{details ? "Hide details" : "Show details"}</button>
      </div>
      {more && <div className="bar" style={{ marginBottom: 20 }}>
        <div className="chips" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button key={s} className="chip" aria-pressed={st === s} onClick={() => setSt(st === s ? null : s)}>
              <span className={`status ${s}`}>{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>
        <select className="field" style={{ minWidth: 0, width: "auto" }} value={group ?? ""} onChange={(e) => setGroup(e.target.value || null)} aria-label="Group">
          <option value="">All groups</option>
          {idx.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </div>}

      <table className="table" ref={tableRef} style={{ scrollMarginTop: 90 }}>
        <thead>
          <tr>
            <th className="sortable" onClick={() => setSort("az")}>Term {sort === "az" ? "↓" : ""}</th>
            {details && <th className="hide-sm">Written</th>}
            <th className="hide-sm">Status</th>
            <th className="r sortable" onClick={() => setSort("n")}>Occurrences {sort === "n" ? "↓" : ""}</th>
            {details && <th className="r sortable hide-sm" onClick={() => setSort("docs")}>Manuscripts {sort === "docs" ? "↓" : ""}</th>}
            {details && <th className="hide-sm">Compositions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} onClick={() => nav(`/substance/${encodeURIComponent(s.id)}`)}>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <ClassMark cls={s.class} title={CLASS_LABEL[s.class]} />
                  <Link to={`/substance/${encodeURIComponent(s.id)}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 500 }}>{s.label}</Link>
                </span>
                <div className="tx-i faint" style={{ fontSize: 14, marginLeft: 19 }}>{s.lemma !== s.label ? s.lemma : ""}</div>
              </td>
              {details && <td className="forms hide-sm">{s.forms.slice(0, 3).join(", ")}</td>}
              <td className="hide-sm"><span className={`status ${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
              <td className="r mono" style={{ whiteSpace: "nowrap" }} title={`${s.nPreserved} of ${s.n} at least partly preserved on the clay`}>{s.n}</td>
              {details && <td className="r mono hide-sm">{s.docs}</td>}
{details && <td className="mono faint hide-sm" style={{ whiteSpace: "nowrap" }}>
                {(() => {
                  const cs = Object.entries(s.cth).sort((a, b) => b[1] - a[1]).map(([c]) => c);
                  return cs.slice(0, 4).join(" ") + (cs.length > 4 ? ` +${cs.length - 4}` : "");
                })()}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
