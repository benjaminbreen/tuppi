import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useData } from "../lib/data";

interface Word { id: string; reading: string; lemma: string | null; gloss: string | null; language: string | null; partOfSpeech: string | null }
interface Line { ref: string; label: string; words: Word[] }
interface TextData { id: string; sourceUrl: string; sourceArchiveTimestamp: string; readingType: string; lines: Line[] }
const MAPPED_RITUALS: Record<string, string> = { Q005039: "cmawro-q005039-3-4-1", Q004189: "cmawro-q004189-1-5-1", Q005063: "cmawro-q005063-8-18" };

export default function CmawroText() {
  const { textId } = useParams();
  const location = useLocation();
  const validId = textId && /^Q\d{6}$/.test(textId) ? textId : null;
  const { data, error } = useData<TextData>(validId ? `corpora/cmawro/texts/${validId}.json` : null);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    if (!data) return [];
    const term = query.trim().toLocaleLowerCase();
    return data.lines.filter((line) => !term || line.words.some((word) => `${word.reading} ${word.lemma ?? ""} ${word.gloss ?? ""}`.toLocaleLowerCase().includes(term)));
  }, [data, query]);
  useEffect(() => {
    if (!data || !location.hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [data, location.hash]);
  if (!validId) return <div className="wrap page"><h1>Text not found</h1></div>;
  if (error) return <div className="wrap page"><h1>Text unavailable</h1><p>{error}</p></div>;
  if (!data) return <div className="wrap loading">Loading…</div>;
  return <div className="wrap page">
    <header className="pagehead">
      <p><Link to="/corpora/cmawro">← CMAwRo texts</Link></p>
      <h1>{data.id}</h1>
      {MAPPED_RITUALS[data.id] && <p><Link to={`/rituals/${MAPPED_RITUALS[data.id]}`}>Explore the mapped ritual from this text →</Link></p>}
      <p className="lede">Edited word readings and lexical glosses from the CC0 Oracc JSON export. This is a reading aid, not a diplomatic sign transcription. <a href={data.sourceUrl} target="_blank" rel="noreferrer">Read the full edition and English translation on Oracc ↗</a></p>
      <input className="field" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a reading, lemma or gloss…" aria-label="Find in text" />
    </header>
    <p className="mono faint">{matches.length} lines with readings · hover or focus a word for its lemma and gloss</p>
    <div className="cmawro-lines">
      {matches.map((line) => <div className="cmawro-line" id={line.ref} key={line.ref}>
        <span className="mono faint">{line.label}</span>
        <span>{line.words.map((word, index) => { const note = [word.lemma && `Lemma: ${word.lemma}`, word.gloss && `Gloss: ${word.gloss}`, word.language && `Language: ${word.language}`].filter(Boolean).join(" · "); return <span className="cmawro-word" tabIndex={0} title={note} aria-label={`${word.reading}${note ? `, ${note}` : ""}`} key={`${word.id}-${index}`}>{word.reading} </span>; })}</span>
      </div>)}
      {!matches.length && <p>No lines match.</p>}
    </div>
  </div>;
}
