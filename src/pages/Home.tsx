import { Link } from "react-router-dom";
import { TranslitLine } from "../components/Translit";
import { useData, useIndex, useSubstances, type Doc } from "../lib/data";
import { RITUAL_CATALOG } from "../lib/ritualCatalog";

const EPIGRAPH = [
  { n: "rev. IV 42", en: "One ritual, the word of Zarpiya: if the year is bad —" },
  { n: "rev. IV 44", en: "one ritual, the word of Uḫḫamuwa: if in the land or a city there is dying —" },
  { n: "rev. IV 46", en: "one ritual, the word of Ašḫella: if in the land or in the army camps death occurs." },
];

function Epigraph() {
  const { data: doc } = useData<Doc>("docs/kub-9-31.json");
  const lines = doc ? doc.lines.filter((l) => /Rs\. IV 4[2-7]$/.test(l.n.trim())) : [];
  const pairs = [lines.slice(0, 2), lines.slice(2, 4), lines.slice(4, 6)];
  return (
    <figure className="epigraph" aria-label="Colophon of KUB 9.31">
      {doc &&
        pairs.map((pl, i) => (
          <div key={i} style={{ display: "grid", gap: 2, marginBottom: 10 }}>
            <div className="cun" aria-hidden>{pl.map((l) => l.cu).join(" ")}</div>
            <div className="tl">
              {pl.map((l, j) => (
                <span key={j}>
                  <TranslitLine tokens={l.w} opts={{ brackets: true, glosses: false, highlight: false }} />{" "}
                </span>
              ))}
            </div>
            <div className="tr">{EPIGRAPH[i].en}</div>
          </div>
        ))}
      <figcaption className="src label">
        Colophon of <Link to="/text/kub-9-31#L-last" className="link">KUB 9.31</Link>, rev. iv 42–47 · a scribe’s own index of three plague rituals from three regions
      </figcaption>
    </figure>
  );
}

export default function Home() {
  const { data: idx } = useIndex();
  const { data: subs } = useSubstances();
  const unknown = subs ? subs.filter((s) => s.status !== "identified").length : null;
  return (
    <div className="wrap">
      <section className="hero">
        <p className="label" style={{ marginBottom: 18 }}>An open workbench for Hittite cuneiform · first slice</p>
        <h1>Plague, medicine and ritual expertise in the Hittite archive.</h1>
        <p className="lede">
          Every manuscript is shown sign by sign as the clay preserves it; what editors restored stays visibly restored. Read the
          main texts in draft English beside the cuneiform, trace substances across the corpus, and map every place the archive names.
        </p>
        <Epigraph />
      </section>

      <Link to="/rituals" className="home-ritual-feature">
        <span className="home-ritual-image"><img src="/rituals/uhhamuwa/04-crown.png" alt="A ram with a multicoloured wool wreath" /></span>
        <span className="home-ritual-copy"><small>RITUALS</small><strong>Annotated ritual sequences</strong><span>Read the steps in Uḫḫamuwa’s and Allī’s rituals with links to the manuscript lines.</span><em>View rituals ↗</em></span>
        <span className="home-ritual-count">{RITUAL_CATALOG.length} rituals</span>
      </Link>

      <section className="entries">
        <Link to="/texts" className="entry">
          <span className="big">{idx ? idx.stats.docs : "…"}</span>
          <h2>Texts <span className="arr">→</span></h2>
          <p>{idx ? `${idx.stats.compositions} compositions, ${idx.stats.lines.toLocaleString()} lines` : ""} with glosses and cuneiform{idx && idx.stats.translated ? `; ${idx.stats.translated} in draft English translation` : ""}.</p>
        </Link>
        <Link to="/substances" className="entry">
          <span className="big">{subs ? subs.length : "…"}</span>
          <h2>Substances <span className="arr">→</span></h2>
          <p>A ledger of materia: plants, minerals, animal products and foods. {unknown !== null && subs ? `${Math.round((unknown / subs.length) * 100)}% are not securely identified.` : ""}</p>
        </Link>
        <Link to="/browser" className="entry">
          <span className="big">{idx ? idx.stats.compositions : "…"}</span>
          <h2>Browser <span className="arr">→</span></h2>
          <p>Every ritual and recipe as a strip of paragraphs: see where substances, languages and damage fall.</p>
        </Link>
        <Link to="/map" className="entry">
          <span className="big">{idx?.stats.places ?? "…"}</span>
          <h2>Map <span className="arr">→</span></h2>
          <p>Places named across all {idx?.stats.corpusTablets?.toLocaleString() ?? "…"} TLHdig tablets, by script period — and where the healers came from.</p>
        </Link>
      </section>

      <section style={{ marginTop: 48 }}>
        <p className="label">In this slice</p>
        <div className="groups">
          {idx?.groups.map((g) => {
            const cs = idx.compositions.filter((c) => c.group === g.id);
            return (
              <Link to={`/texts#${g.id}`} key={g.id} className="grouprow">
                <h3>{g.label}</h3>
                <p className="muted" style={{ fontSize: 14 }}>{g.blurb}</p>
                <p className="mono faint">
                  {cs.length} {cs.length === 1 ? "composition" : "compositions"} · {cs.reduce((a, c) => a + c.nDocs, 0)} manuscripts
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
