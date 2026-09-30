import { Link, useSearchParams } from "react-router-dom";
import { RITUAL_CATALOG, RITUAL_CONCERNS, type RitualCatalogEntry } from "../lib/ritualCatalog";

export default function RitualsIndex() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const corpus = params.get("corpus") ?? "";
  const concern = params.get("concern") ?? "";
  const requestedSort = params.get("sort") ?? "title";
  const sort = ["title", "title-desc", "cth", "cth-desc", "steps-desc", "steps-asc"].includes(requestedSort) ? requestedSort : "title";
  const view = params.get("view") === "cards" ? "cards" : "list";
  const requestedShown = Number(params.get("shown"));
  const shown = Number.isFinite(requestedShown) && requestedShown > 24 ? Math.ceil(requestedShown / 24) * 24 : 24;

  const setOption = (name: string, value: string, defaultValue = "") => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === defaultValue) next.delete(name);
      else next.set(name, value);
      if (name !== "view" && name !== "shown") next.delete("shown");
      return next;
    }, { replace: true });
  };

  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visible = RITUAL_CATALOG.filter((ritual) => {
    if (corpus && ritual.corpusId !== corpus) return false;
    if (concern && ritual.concern !== concern) return false;
    const text = [ritual.id, ritual.title, ritual.sourceLabel, ritual.concern, ritual.region, ritual.sources, ritual.description, ...ritual.tags, ...ritual.searchTerms].join(" ").toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  }).sort((a, b) => {
    switch (sort) {
      case "title-desc": return b.title.localeCompare(a.title);
      case "cth": return (a.cth ?? Infinity) - (b.cth ?? Infinity);
      case "cth-desc": return (b.cth ?? -Infinity) - (a.cth ?? -Infinity);
      case "steps-desc": return b.stepCount - a.stepCount || a.title.localeCompare(b.title);
      case "steps-asc": return a.stepCount - b.stepCount || a.title.localeCompare(b.title);
      default: return a.title.localeCompare(b.title);
    }
  });

  return (
    <div className="wrap page ritual-page">
      <header className="ritual-index-hero">
        <div className="ritual-index-copy">
          <h1>Explore rituals</h1>
          <p>Browse Hittite rituals and {RITUAL_CATALOG.filter((ritual) => ritual.corpusId === "cmawro").length} mapped Mesopotamian procedures by subject and source. <Link to="/corpora/cmawro#ritual-candidates">See the next 20 CMAwRo candidates →</Link></p>
        </div>
        <div className="ritual-index-art" aria-hidden="true">
          <img src="/rituals/uhhamuwa/04-crown.png" alt="" />
        </div>
      </header>

      <section id="catalogue" className="ritual-catalogue" aria-labelledby="ritual-catalogue-heading">
        <div className="ritual-catalogue-heading">
          <h2 id="ritual-catalogue-heading">Ritual catalogue</h2>
          <div className="ritual-catalogue-heading-actions"><span aria-live="polite">{visible.length} {visible.length === 1 ? "ritual" : "rituals"}</span><Link to="/rituals/create">Create your own ritual ↗</Link><Link to="/ritual-units">Browse ritual tasks ↗</Link><Link to="/ritual-atoms">Ritual grammar ↗</Link></div>
        </div>
        <div className="ritual-catalogue-controls">
          <label className="ritual-catalogue-search">Search
            <input type="search" value={query} onChange={(event) => setOption("q", event.target.value)} placeholder="Title, CTH, object, action…" />
          </label>
          <label>Corpus
            <select value={corpus} onChange={(event) => setOption("corpus", event.target.value)}>
              <option value="">All corpora</option><option value="tlhdig-hittite">Hittite</option><option value="cmawro">Mesopotamian</option>
            </select>
          </label>
          <label>Subject
            <select value={concern} onChange={(event) => setOption("concern", event.target.value)}>
              <option value="">All subjects</option>
              {RITUAL_CONCERNS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Sort
            <select value={sort} onChange={(event) => setOption("sort", event.target.value, "title")}>
              <option value="title">Title A–Z</option>
              <option value="title-desc">Title Z–A</option>
              <option value="cth">CTH ascending (Hittite)</option>
              <option value="cth-desc">CTH descending (Hittite)</option>
              <option value="steps-desc">Most steps</option>
              <option value="steps-asc">Fewest steps</option>
            </select>
          </label>
          <div className="ritual-catalogue-switch" role="group" aria-label="Catalogue view">
            <button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => setOption("view", "list", "list")}>List</button>
            <button type="button" className={view === "cards" ? "active" : ""} aria-pressed={view === "cards"} onClick={() => setOption("view", "cards", "list")}>Cards</button>
          </div>
        </div>
        {visible.length ? (
          <div className={`ritual-catalogue-results ${view}`}>
            {visible.slice(0, shown).map((ritual: RitualCatalogEntry) => (
              <article className="ritual-catalogue-item" key={ritual.id}>
                <Link className="ritual-catalogue-images" to={ritual.path} aria-label={`View ${ritual.title}`}>
                  {ritual.images.map((image) => <img key={image} src={image} alt="" loading="lazy" />)}
                </Link>
                <div className="ritual-catalogue-copy">
                  <p className="ritual-catalogue-tags">{ritual.tags.join(" · ")}</p>
                  <h3><Link to={ritual.path}>{ritual.title}</Link></h3>
                  <p className="ritual-catalogue-description">{ritual.description}</p>
                  <p className="ritual-catalogue-source">{ritual.sources}</p>
                </div>
                <div className="ritual-catalogue-facts"><span>{ritual.sourceLabel}</span><span>{ritual.stepCount} {ritual.stepCount === 1 ? "step" : "steps"}</span></div>
                <Link className="ritual-catalogue-open" to={ritual.path}>View ritual <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        ) : <div className="ritual-catalogue-empty"><p>No rituals match this search.</p><button type="button" onClick={() => setParams({}, { replace: true })}>Clear filters</button></div>}
        {visible.length > shown && <button type="button" className="ritual-catalogue-more" onClick={() => setOption("shown", String(shown + 24), "24")}>Show 24 more rituals <span>{shown} of {visible.length}</span></button>}
      </section>
    </div>
  );
}
