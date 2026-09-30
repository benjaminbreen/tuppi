import { Link, useSearchParams } from "react-router-dom";
import { ACTION_TYPES, RITUAL_DEITIES, RITUAL_UNITS, RITUAL_VISUALS, relatedRitualUnits, ritualUnitHref } from "../lib/ritualEdition";

const categories = Array.from(new Set(Object.values(RITUAL_UNITS).map((unit) => unit.actionType))).sort((a, b) => ACTION_TYPES[a].title.localeCompare(ACTION_TYPES[b].title));
const allUnits = Object.entries(RITUAL_UNITS).map(([id, unit]) => {
  const occurrences = relatedRitualUnits(id);
  return { id, ...unit, rituals: new Set(occurrences.map((item) => item.ritualId)).size, occurrences: occurrences.length, image: unit.deityVisualId ? RITUAL_DEITIES[unit.deityVisualId].src : RITUAL_VISUALS[unit.visualAssetId].src };
});

export default function RitualUnitsIndex() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const shared = params.get("shared") === "1";
  const sort = params.get("sort") === "title" ? "title" : "shared";
  const shown = Math.max(24, Number(params.get("shown")) || 24);
  const setOption = (key: string, value: string, defaultValue = "") => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value === defaultValue) next.delete(key); else next.set(key, value);
    if (key !== "shown") next.delete("shown");
    return next;
  }, { replace: true });
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visible = allUnits.filter((unit) => {
    if (category && unit.actionType !== category) return false;
    if (shared && unit.rituals < 2) return false;
    const haystack = `${unit.title} ${unit.description} ${ACTION_TYPES[unit.actionType].title} ${unit.id}`.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : b.rituals - a.rituals || a.title.localeCompare(b.title));

  return <div className="wrap page ritual-page ritual-units-index">
    <div className="crumbs"><Link to="/rituals">Rituals</Link><span className="sep">/</span><span>Actions</span></div>
    <header className="ritual-units-index-head"><h1>Ritual actions</h1><p>Browse individual acts and utterances, and see which rituals use them.</p></header>
    <section className="ritual-catalogue" aria-label="Action catalogue">
      <div className="ritual-catalogue-heading"><h2>Action catalogue</h2><span aria-live="polite">{visible.length} {visible.length === 1 ? "action" : "actions"}</span></div>
      <div className="ritual-unit-filters">
        <label>Search<input type="search" value={query} onChange={(event) => setOption("q", event.target.value)} placeholder="Sheep, wool, offering…" /></label>
        <label>Action<select value={category} onChange={(event) => setOption("category", event.target.value)}><option value="">All actions</option>{categories.map((id) => <option value={id} key={id}>{ACTION_TYPES[id].title}</option>)}</select></label>
        <label>Sort<select value={sort} onChange={(event) => setOption("sort", event.target.value, "shared")}><option value="shared">Most rituals</option><option value="title">Title A–Z</option></select></label>
        <label className="ritual-unit-shared"><input type="checkbox" checked={shared} onChange={(event) => setOption("shared", event.target.checked ? "1" : "")} /> Shared across rituals</label>
      </div>
      {visible.length ? <div className="ritual-unit-grid">{visible.slice(0, shown).map((unit) => <Link className="ritual-unit-card" key={unit.id} to={ritualUnitHref(unit.id)}>
        <span className="ritual-unit-card-image"><img src={unit.image} alt="" loading="lazy" /></span>
        <span className="ritual-unit-card-copy"><small>{ACTION_TYPES[unit.actionType].title}</small><strong>{unit.title}</strong><span>{unit.rituals} {unit.rituals === 1 ? "ritual" : "rituals"}<i aria-hidden="true">↗</i></span></span>
      </Link>)}</div> : <div className="ritual-catalogue-empty"><p>No actions match this search.</p><button type="button" onClick={() => setParams({}, { replace: true })}>Clear filters</button></div>}
      {visible.length > shown && <button className="ritual-catalogue-more" type="button" onClick={() => setOption("shown", String(shown + 24), "24")}>Show 24 more actions <span>{shown} of {visible.length}</span></button>}
    </section>
  </div>;
}
