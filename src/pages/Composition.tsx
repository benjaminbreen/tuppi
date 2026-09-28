import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClassMark, PeriodDots, PresBar } from "../components/Marks";
import RitualAtGlance from "../components/RitualAtGlance";
import { RITUAL_CATALOG } from "../lib/ritualCatalog";
import { useRitualEdition } from "../lib/ritualEdition";
import { PERIOD_LABEL, useIndex, useSubstances, useTrIndex } from "../lib/data";

export default function Composition() {
  const { cth = "" } = useParams();
  const { data: idx } = useIndex();
  const { data: subs } = useSubstances();
  const { data: tr } = useTrIndex();
  const nav = useNavigate();
  const comp = idx?.compositions.find((c) => c.cth === cth);
  const ritual = RITUAL_CATALOG.find((entry) => String(entry.cth) === cth);
  const ritualEdition = useRitualEdition(ritual?.id);
  const sharedTablet = ritualEdition?.steps.flatMap((step) => step.attestations).find((attestation) => attestation.doc === "kub-9-31" && !comp?.docs.includes(attestation.doc));
  const docs = useMemo(() => (idx && comp ? comp.docs.map((id) => idx.docs.find((d) => d.id === id)!).filter(Boolean) : []), [idx, comp]);
  const top = useMemo(
    () => (subs ? subs.filter((s) => s.cth[cth]).sort((a, b) => (b.cth[cth] || 0) - (a.cth[cth] || 0)).slice(0, 24) : []),
    [subs, cth],
  );
  if (!idx) return <div className="wrap loading">Loading…</div>;
  if (!comp) return <div className="wrap page"><h1>Unknown composition</h1></div>;
  const group = idx.groups.find((g) => g.id === comp.group);
  const maxN = Math.max(1, ...top.map((s) => s.cth[cth] || 0));
  return (
    <div className="wrap page">
      <header className="pagehead">
        <div className="crumbs">
          <Link to="/texts">Texts</Link><span className="sep">/</span>
          <Link to={`/texts#${comp.group}`}>{group?.label}</Link><span className="sep">/</span>
          <span className="mono">CTH {comp.cth}</span>
        </div>
        <h1>{comp.cth === "402" ? "Ritual of Allī" : comp.title}</h1>
        <div className="docmeta">
          {comp.who && <span><span className="faint">Attributed to </span><b>{comp.cth === "402" ? "Allī, woman of Arzawa" : comp.who}</b></span>}
          {comp.from && <span><span className="faint">From </span><b>{comp.from}</b></span>}
          {comp.concern && <span><span className="faint">Concern </span><b>{comp.concern}</b></span>}
          <span className="faint">
            <a className="link" href={`https://hethport.net/CTH/cthfix.php?c=${comp.cth}`} target="_blank" rel="noreferrer">CTH catalogue ↗</a>
          </span>
        </div>
      </header>

      {ritual && <RitualAtGlance ritualId={ritual.id} />}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 40 }}>
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
            <h2>Manuscripts</h2>
            <PeriodDots periods={comp.periods} />
          </div>
          {sharedTablet && <p className="ritual-shared-tablet">This ritual also appears on <Link to={`/text/kub-9-31#P${sharedTablet.anchor.index}`}>KUB 9.31 ↗</Link>, filed in this catalogue under CTH 757.</p>}
          <table className="table">
            <thead>
              <tr>
                <th>Manuscript</th>
                <th className="hide-sm">Copy</th>
                <th className="hide-sm">Script</th>
                <th className="hide-sm">Find-spot</th>
                <th className="r">Lines</th>
                <th className="r hide-sm">Preserved</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} onClick={() => nav(`/text/${d.id}`)}>
                  <td>
                    <Link to={`/text/${d.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 500 }}>{d.docid}</Link>
                    {tr?.[d.id] && <span className="en-badge" style={{ marginLeft: 8 }} title="Draft English translation">EN</span>}
                    {d.pubs.length > 1 && <div className="mono faint" style={{ marginTop: 2 }}>{d.pubs.join(" + ")}</div>}
                  </td>
                  <td className="mono hide-sm">{d.cthSub || "—"}</td>
                  <td className="hide-sm">{d.period ? PERIOD_LABEL[d.period] : <span className="faint">—</span>}</td>
                  <td className="hide-sm faint" style={{ fontSize: 13, maxWidth: 320 }}>{d.find ? d.find.replace(/\s*-\s*$/, "") : "—"}</td>
                  <td className="r mono">{d.nlines}</td>
                  <td className="r hide-sm"><PresBar v={d.pres} /> <span className="mono faint">{Math.round(d.pres * 100)}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {top.length > 0 && (
          <section>
            <h2 style={{ marginBottom: 4 }}>Substances in this composition</h2>
            <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>Occurrences across all its manuscripts, including restored passages.</p>
            <div className="hbars">
              {top.map((s) => (
                <Link to={`/substance/${encodeURIComponent(s.id)}`} className="hb" key={s.id}>
                  <span className="t" style={{ display: "flex", alignItems: "center", gap: 8 }}><ClassMark cls={s.class} /> {s.label}</span>
                  <span className="bar"><i style={{ width: `${((s.cth[cth] || 0) / maxN) * 100}%` }} /></span>
                  <span className="mono faint r">{s.cth[cth]}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
