import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../lib/data";
import candidates from "../data/corpus-audits/cmawro-top-20.json";

interface Entry {
  id: string; sourceUrl: string; title: string; seriesId: string; edition: string | null;
  group: string; category: string | null; genre: string | null; tokenCount: number;
  englishOnOracc: boolean; witnessCount: number; witnessPeriods: string[]; findspots: string[];
}
interface Catalog {
  sourceArchiveTimestamp: string;
  stats: { masterTextEditions: number; masterTextsWithTokens: number; masterTextsMarkedEnglishTranslation: number; sourceWitnessEditions: number };
  entries: Entry[];
}

export default function CmawroCatalog() {
  const { data, error } = useData<Catalog>("corpora/cmawro.json");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [textOnly, setTextOnly] = useState(false);
  const [shown, setShown] = useState(40);
  const categories = useMemo(() => [...new Set(data?.entries.map((entry) => entry.category).filter((value): value is string => Boolean(value)) ?? [])].sort(), [data]);
  const periods = useMemo(() => [...new Set(data?.entries.flatMap((entry) => entry.witnessPeriods) ?? [])].sort(), [data]);
  const matches = useMemo(() => {
    if (!data) return [];
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return data.entries.filter((entry) =>
      (!category || entry.category === category) && (!period || entry.witnessPeriods.includes(period)) &&
      (!textOnly || entry.tokenCount > 0) &&
      terms.every((term) => `${entry.id} ${entry.seriesId} ${entry.title} ${entry.category ?? ""} ${entry.edition ?? ""} ${entry.findspots.join(" ")}`.toLocaleLowerCase().includes(term)),
    );
  }, [data, query, category, period, textOnly]);
  if (error) return <div className="wrap page"><p>Could not load CMAwRo metadata: {error}</p></div>;
  if (!data) return <div className="wrap loading">Loading…</div>;
  return <div className="wrap page">
    <header className="pagehead">
      <p><Link to="/corpora">← Corpora</Link></p>
      <h1>CMAwRo texts</h1>
      <p><Link to="/corpora/search">Search all imported corpus lines →</Link></p>
      <p><a href="#ritual-candidates">Top 20 ritual mapping candidates ↓</a> · <Link to="/rituals?corpus=cmawro">View mapped Mesopotamian rituals →</Link></p>
      <p className="lede">{data.stats.masterTextEditions} master-text records; {data.stats.masterTextsWithTokens} have transliterated text in the Oracc JSON exports. {data.stats.masterTextsMarkedEnglishTranslation} are marked as having English translation on Oracc. These counts describe texts, not distinct rituals or procedures. Archive snapshot: {data.sourceArchiveTimestamp.slice(0, 10)}.</p>
    </header>
    <section id="ritual-candidates" className="cmawro-candidates">
      <h2>Top 20 mapping candidates</h2>
      <p>The first two have mapped, source-anchored steps. The remaining entries are a screening queue based on catalogue titles, text length and numbered source units; their procedure boundaries still need reading and verification. The earlier 3.4.1 pilot is already mapped separately.</p>
      <ol>
        {candidates.map((candidate) => {
          const entry = data.entries.find((item) => item.id === candidate.id);
          return <li key={`${candidate.id}-${candidate.unit}`}>
            <div><strong>{candidate.unit} · {entry?.title ?? candidate.id}</strong><span className="mono faint">{candidate.id} · {entry?.tokenCount ?? 0} parent-text tokens</span></div>
            <p>{candidate.reason}</p>
            <div className="cmawro-candidate-links"><span className={`status ${candidate.status}`}>{candidate.status === "mapped" ? "Mapped" : "To verify"}</span>{"ritualId" in candidate && <Link to={`/rituals/${candidate.ritualId}`}>View mapping →</Link>}<Link to={`/corpora/cmawro/text/${candidate.id}`}>Read imported text →</Link>{entry && <a href={entry.sourceUrl} target="_blank" rel="noreferrer">Oracc edition ↗</a>}</div>
          </li>;
        })}
      </ol>
    </section>
    <div className="corpus-filters">
      <input className="field" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setShown(40); }} placeholder="Search title, source ID, place…" aria-label="Search CMAwRo texts" />
      <select className="field" value={category} onChange={(event) => { setCategory(event.target.value); setShown(40); }} aria-label="Text category"><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <select className="field" value={period} onChange={(event) => { setPeriod(event.target.value); setShown(40); }} aria-label="Witness period"><option value="">All witness periods</option>{periods.map((item) => <option key={item}>{item}</option>)}</select>
      <label><input type="checkbox" checked={textOnly} onChange={(event) => { setTextOnly(event.target.checked); setShown(40); }} /> With transliteration</label>
    </div>
    <p className="mono faint">{matches.length} matching master texts · witness period comes from linked manuscript metadata</p>
    <div className="corpus-results">
      {matches.slice(0, shown).map((entry) => <article className="corpus-result" key={entry.id}>
        <div><span className="mono faint">{entry.seriesId} · {entry.id}</span><h2><Link to={`/corpora/cmawro/text/${entry.id}`}>{entry.title}</Link></h2><p>{entry.category ?? entry.genre ?? "Unclassified"} · <a href={entry.sourceUrl} target="_blank" rel="noreferrer">Oracc edition ↗</a></p></div>
        <div className="corpus-result-facts"><span>{entry.tokenCount > 0 ? `${entry.tokenCount.toLocaleString()} tokens` : "No exported tokens"}</span><span>{entry.witnessCount} linked witness{entry.witnessCount === 1 ? "" : "es"}</span>{entry.englishOnOracc && <span>English on Oracc</span>}<span>{entry.witnessPeriods.join(" · ") || "Witness period unknown"}</span></div>
      </article>)}
    </div>
    {matches.length > shown && <button className="ritual-catalogue-more" onClick={() => setShown(shown + 40)}>Show 40 more</button>}
  </div>;
}
