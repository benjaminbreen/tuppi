import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData, useIndex } from "../lib/data";

interface SearchLine { corpus: "cmawro" | "hittite"; id: string; label: string; reading: string; lexical: string }
interface SearchIndex { version: number; rows: SearchLine[] }
interface CmawroEntry { id: string; title: string; category: string | null; witnessPeriods: string[] }
interface CmawroCatalog { entries: CmawroEntry[] }

export default function CorpusSearch() {
  const { data: lines, error } = useData<SearchIndex>("corpora/search-lines.json");
  const { data: cmawro } = useData<CmawroCatalog>("corpora/cmawro.json");
  const { data: hittite } = useIndex();
  const [query, setQuery] = useState("");
  const [corpus, setCorpus] = useState("");
  const [period, setPeriod] = useState("");
  const [category, setCategory] = useState("");
  const [shown, setShown] = useState(50);
  const cmawroById = useMemo(() => new Map(cmawro?.entries.map((entry) => [entry.id, entry]) ?? []), [cmawro]);
  const hittiteById = useMemo(() => new Map(hittite?.docs.map((entry) => [entry.id, entry]) ?? []), [hittite]);
  const periods = useMemo(() => [...new Set([...(cmawro?.entries.flatMap((entry) => entry.witnessPeriods) ?? []), ...(hittite?.docs.map((entry) => entry.period).filter((value): value is NonNullable<typeof value> => Boolean(value)) ?? [])])].sort(), [cmawro, hittite]);
  const categories = useMemo(() => [...new Set([...(cmawro?.entries.map((entry) => entry.category).filter((value): value is string => Boolean(value)) ?? []), ...(hittite?.compositions.map((entry) => entry.group) ?? [])])].sort(), [cmawro, hittite]);
  const matches = useMemo(() => {
    if (!lines || !cmawro || !hittite) return [];
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return lines.rows.filter((line) => {
      if (corpus && line.corpus !== corpus) return false;
      const cm = line.corpus === "cmawro" ? cmawroById.get(line.id) : null;
      const ht = line.corpus === "hittite" ? hittiteById.get(line.id) : null;
      if (period && !(cm?.witnessPeriods.includes(period) || ht?.period === period)) return false;
      if (category && !(cm?.category === category || ht?.group === category)) return false;
      const haystack = `${line.reading} ${line.lexical}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [lines, cmawro, hittite, query, corpus, period, category, cmawroById, hittiteById]);
  return <div className="wrap page">
    <header className="pagehead">
      <p><Link to="/corpora">← Corpora</Link></p>
      <h1>Search corpus lines</h1>
      <p className="lede">Search edited readings and lexical glosses across imported Hittite and CMAwRo lines. Periods describe surviving witnesses, not when a procedure was first composed. The two source projects use different period labels.</p>
    </header>
    <div className="corpus-filters">
      <input className="field" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setShown(50); }} placeholder="Search readings, lemmas or glosses…" aria-label="Search corpus lines" />
      <select className="field" value={corpus} onChange={(event) => { setCorpus(event.target.value); setShown(50); }} aria-label="Corpus"><option value="">Both corpora</option><option value="hittite">Hittite</option><option value="cmawro">CMAwRo</option></select>
      <select className="field" value={period} onChange={(event) => { setPeriod(event.target.value); setShown(50); }} aria-label="Witness period"><option value="">All witness periods</option>{periods.map((value) => <option key={value}>{value}</option>)}</select>
      <select className="field" value={category} onChange={(event) => { setCategory(event.target.value); setShown(50); }} aria-label="Source category"><option value="">All source categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
    </div>
    {error && <p>Search index unavailable: {error}</p>}
    {!lines && !error && <p>Loading line index…</p>}
    {lines && <p className="mono faint">{query.trim() ? `${matches.length.toLocaleString()} matching lines` : `${lines.rows.length.toLocaleString()} indexed lines; enter a term to search`}</p>}
    <div className="corpus-results">
      {matches.slice(0, shown).map((line, index) => {
        const cm = cmawroById.get(line.id);
        const ht = hittiteById.get(line.id);
        const to = line.corpus === "cmawro" ? `/corpora/cmawro/text/${line.id}` : `/text/${line.id}`;
        return <article className="corpus-search-hit" key={`${line.corpus}-${line.id}-${line.label}-${index}`}>
          <div className="mono faint">{line.corpus === "cmawro" ? "CMAwRo" : "Hittite"} · {line.id} · line {line.label}</div>
          <h2><Link to={to}>{cm?.title ?? ht?.docid ?? line.id}</Link></h2>
          <p className="corpus-search-reading">{line.reading}</p>
          {line.lexical && <p className="faint corpus-search-lexical">Lexical: {line.lexical}</p>}
          <p className="mono faint">{cm?.category ?? ht?.group ?? "Unclassified"} · {cm?.witnessPeriods.join(", ") || ht?.period || "Period unknown"}</p>
        </article>;
      })}
    </div>
    {matches.length > shown && <button className="ritual-catalogue-more" onClick={() => setShown(shown + 50)}>Show 50 more</button>}
  </div>;
}
