import { Link } from "react-router-dom";
import { useIndex } from "../lib/data";

export default function About() {
  const { data: idx } = useIndex();
  return (
    <div className="wrap page">
      <header className="pagehead">
        <h1>About tuppi</h1>
        <p className="lede">
          <span className="tx-i">tuppi-</span> is the Hittite word for a clay tablet. This site is an open workbench for reading the
          Hittite archive as it survives, built on the TLHdig corpus.
        </p>
      </header>
      <div className="prose">
        <h2>This slice</h2>
        <p>
          The first slice gathers texts about plague, medicine and ritual expertise
          {idx ? `: ${idx.stats.compositions} compositions in ${idx.stats.docs} manuscripts (${idx.stats.lines.toLocaleString()} lines, ${idx.stats.words.toLocaleString()} words)` : ""}.
          It includes the plague rituals attributed to experts from Arzawa, Ḫapalla and Kizzuwatna, Muršili II’s plague prayers, Hittite
          medical texts and lists of magical substances, Babylonian medical texts copied at Ḫattuša, and the healing rituals of
          Alli, Paškuwatti and Tunnawiya.
        </p>

        <h2>How to read the texts</h2>
        <ul>
          <li><span className="tx-i">Italic</span> syllables are Hittite (or Akkadian) spelled out; <span className="tx">UPRIGHT CAPITALS</span> are Sumerian word-signs; italic capitals are Akkadian word-signs.</li>
          <li>Small raised signs are determinatives, unpronounced class markers: <span className="tx">ᵈ</span> god, <span className="tx">ᵐ</span> man, <span className="tx">ᶠ</span> woman, <span className="tx"><sup>GIŠ</sup></span> wood, <span className="tx"><sup>Ú</sup></span> plant, <span className="tx"><sup>NA₄</sup></span> stone, <span className="tx"><sup>URU</sup></span> town.</li>
          <li><span style={{ color: "var(--restored)" }}>[Grey text in square brackets]</span> is restored by modern editors, often from another copy. ⸢Half brackets⸣ mark damaged but legible signs. Nothing restored is ever shown as if it survived.</li>
          <li>A horizontal rule is the scribe’s own paragraph line, drawn across the clay; a double rule is a double line.</li>
          <li>Line numbers follow the edition: obv. / rev. = obverse / reverse, Roman numerals are columns, a prime (′) means the count restarts after a break.</li>
        </ul>

        <h2>Sources and licences</h2>
        <p>The <Link to="/corpora/cmawro">CMAwRo catalogue</Link> adds metadata for 264 Mesopotamian anti-witchcraft master texts from official Oracc JSON exports (archive snapshot 4 July 2024). The exports declare CC0. Tuppi currently links to the editions and English translations on Oracc; it does not reproduce those texts. Master texts, manuscript witnesses and distinct ritual procedures are counted separately.</p>
        <ul>
          <li>
            Texts, readings, word analyses and German glosses: <a href="https://zenodo.org/records/20328284" target="_blank" rel="noreferrer">TLHdig Beta 0.3</a> (Thesaurus Linguarum
            Hethaeorum digitalis), G. Müller, D. Prechel, E. Rieken, D. Schwemer et al., May 2026, CC BY 4.0.
          </li>
          <li>
            Script dates, find-spots, inventory numbers and copy sigla: <a href="https://hethport.net/hetkonk/" target="_blank" rel="noreferrer">Konkordanz der hethitischen Keilschrifttafeln</a>,
            S. Košak, G.G.W. Müller, Ch.W. Steitler, Hethitologie-Portal Mainz, CC BY-SA 4.0. Because of the share-alike terms, the
            derived data published here are CC BY-SA 4.0.
          </li>
          <li>Composition numbers and titles follow the <a href="https://hethport.net/CTH/" target="_blank" rel="noreferrer">Catalogue des Textes Hittites</a>.</li>
        </ul>

        <h2>Method and caveats</h2>
        <ul>
          <li><b>English glosses</b> were translated from TLHdig’s German dictionary glosses for this site (1,311 distinct glosses); the German original is shown next to each one.</li>
          <li><b>Word analyses</b> are TLHdig’s. Where the editors selected one analysis it is marked; where several are possible, all are listed. Akkadian and Hurrian words are mostly unanalysed.</li>
          <li><b>Substances</b> are tagged from a curated list of lemmas plus the scribes’ own determinatives (<span className="tx"><sup>Ú</sup></span>, <sup className="tx">SAR</sup>). The list fixes some wrong-sense selections (e.g. GEŠTIN “wine”, not “wine official”) but adds no new identifications; its status column only reports what TLHdig says.</li>
          <li><b>Dates</b> are script periods of the surviving copy (Old, Middle, New, late New script) from the Konkordanz — not dates of composition.</li>
          <li><b>Preservation</b> is computed from the bracket markup: the share of signs outside editorial restorations.</li>
        </ul>

        <h2>Translations</h2>
        <p>
          The English translations are drafts made for this site by an AI model (Claude), working paragraph by paragraph from the TLHdig
          transliteration and its word analyses, and checked against the duplicates where they exist. They have <b>not</b> been reviewed by a
          Hittitologist. They follow the scribe’s own paragraph rulings, so each block of English sits beside the lines it renders.
        </p>
        <ul>
          <li><span className="rs"><span className="bk">[</span>Grey words in brackets<span className="bk">]</span></span> are restored in the edition; <span className="lost">[…]</span> is lost; <span className="q">(?)</span> marks an uncertain rendering; words in (parentheses) are supplied for sense.</li>
          <li>Luwian, Hurrian and Sumerian passages are summarised or left untranslated rather than guessed.</li>
          <li>Each translation names the published editions to check it against. Where the draft and an edition disagree, trust the edition.</li>
        </ul>

        <h2>Rituals</h2>
        <p>
          The Rituals section contains manually segmented sequences for Uḫḫamuwa (CTH 410) and Allī (CTH 402).
          Each numbered unit records a physical act or prescribed utterance and links to the manuscript lines.
          Allī’s sequence aligns actions across surviving copies; the page identifies the differing placement of the burial.
        </p>
        <p>
          Reconstruction images are AI-generated interpretive cutouts. Step pages record the textual basis and illustrative details.
          Uḫḫamuwa’s step pages also link to selected parallels in Ašḫella’s ritual.
        </p>

        <h2>Map</h2>
        <ul>
          <li><b>Places</b> are words written with the city, land, river or mountain determinative (<span className="tx"><sup>URU</sup></span>, <span className="tx"><sup>KUR</sup></span>, <span className="tx"><sup>ÍD</sup></span>, <span className="tx"><sup>ḪUR.SAG</sup></span>) in all 23,921 TLHdig tablets and fragments, grouped by TLHdig’s normalised names. Counts are tablets, not mentions.</li>
          <li><b>Locations</b> come from a small hand-made gazetteer (55 places), marked as identified sites, proposed and debated locations, or broad regions whose label point is not a location. Coordinates of modern sites are from Wikidata. The other 500-odd places have no agreed location and are listed below the map.</li>
          <li><b>Time</b> is the script date of each tablet from the Konkordanz. It dates the copy, not the text, and 7,729 fragments have no script date.</li>
          <li><b>Connections</b> join places named within three lines of each other on at least two tablets: itineraries, lists of cult towns, treaty clauses.</li>
          <li>Basemap: Natural Earth (public domain), via world-atlas and sane-topojson. No modern borders are drawn.</li>
        </ul>

        <h2>Next</h2>
        <ul>
          <li>An identification ledger for each substance: every proposed identification with its source, evidence and confidence.</li>
          <li>A formula explorer: the stock phrases of ritual and festival texts as objects you can follow across genres and centuries.</li>
          <li>Networks of gods and of people (practitioners, scribes, kings) built from co-occurrence and colophons.</li>
          <li>Specialist review of the draft translations, with reviewers credited per paragraph.</li>
          <li>The full corpus of about 24,000 manuscripts, with a tool that places unidentified fragments among known compositions.</li>
        </ul>
        <p style={{ marginTop: 28 }}><Link to="/texts">Start reading →</Link></p>
      </div>
    </div>
  );
}
