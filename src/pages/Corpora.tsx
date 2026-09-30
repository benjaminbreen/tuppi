import { Link } from "react-router-dom";
import { CORPORA, formatDateRange } from "../lib/corpora";
import { useIndex } from "../lib/data";
import { RITUAL_CATALOG } from "../lib/ritualCatalog";
import cmawroAudit from "../data/corpus-audits/cmawro-catalogue.json";

export default function Corpora() {
  const { data: index } = useIndex();
  return <div className="wrap page">
    <header className="pagehead">
      <h1>Corpora</h1>
      <p className="lede">Browse imported Hittite and CMAwRo texts alongside sources being evaluated for future imports. Catalogue sizes have not been counted as distinct rituals.</p>
      <p><Link to="/corpora/search">Search lines across imported corpora →</Link></p>
    </header>
    <div className="corpus-grid">
      {CORPORA.map((corpus) => <article className="corpus-card" key={corpus.id}>
        <div className="corpus-card-top"><span className={`status ${corpus.stage}`}>{corpus.stage}</span><span className="mono faint">{corpus.id}</span></div>
        <h2>{corpus.name}</h2>
        <p>{corpus.coverage}</p>
        <dl>
          <div><dt>Culture</dt><dd>{corpus.culture}</dd></div>
          <div><dt>Languages</dt><dd>{corpus.languages.join(", ")}</dd></div>
          <div><dt>Scripts</dt><dd>{corpus.scripts.join(", ")}</dd></div>
          <div><dt>Relevant genres</dt><dd>{corpus.genres.join(", ")}</dd></div>
          <div><dt>Dates</dt><dd>{formatDateRange(corpus.dateRange)}</dd></div>
          <div><dt>Provider</dt><dd>{corpus.provider}{corpus.sourceVersion ? ` ${corpus.sourceVersion}` : ""}</dd></div>
          <div><dt>Reuse</dt><dd><a href={corpus.rightsUrl} target="_blank" rel="noreferrer">{corpus.reuseStatus}</a>: {corpus.rights}</dd></div>
          {corpus.stage === "imported" && <div><dt>Local selection</dt><dd>{index ? `${index.stats.compositions} compositions · ${index.stats.docs} manuscripts · ${RITUAL_CATALOG.filter((item) => item.corpusId === "tlhdig-hittite").length} edited ritual sequences` : "Loading counts…"}</dd></div>}
          {corpus.id === "cmawro" && <div><dt>Ritual mappings</dt><dd><Link to="/rituals?corpus=cmawro">Review the mapped procedures →</Link> · <Link to="/corpora/cmawro#ritual-candidates">Top 20 candidates →</Link></dd></div>}
          {corpus.id === "cmawro" && <div><dt>Audit note</dt><dd><a href={cmawroAudit.sourceUrl} target="_blank" rel="noreferrer">Catalogue outline ↗</a> · observed {cmawroAudit.observedOn}</dd></div>}
        </dl>
        <p className="corpus-links"><a href={corpus.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>{corpus.stage === "imported" && <Link to="/texts">Explore texts →</Link>}{corpus.id === "cmawro" && <Link to="/corpora/cmawro">Browse 264 records →</Link>}</p>
      </article>)}
    </div>
  </div>;
}
