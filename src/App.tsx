import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import Search from "./components/Search";
import About from "./pages/About";
import Browser from "./pages/Browser";
import MapPage from "./pages/Map";
import Composition from "./pages/Composition";
import Home from "./pages/Home";
import Reader from "./pages/Reader";
import RitualsIndex from "./pages/RitualsIndex";
import SubstancePage from "./pages/Substance";
import Substances from "./pages/Substances";
import Texts from "./pages/Texts";
import WordPage from "./pages/Word";

type Theme = "system" | "light" | "dark";

const RitualSequence = lazy(() => import("./pages/RitualReader").then((page) => ({ default: page.RitualSequence })));
const RitualStepPage = lazy(() => import("./pages/RitualReader").then((page) => ({ default: page.RitualStepPage })));

function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem("tuppi-theme");
      return t === "light" || t === "dark" ? t : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === "system") localStorage.removeItem("tuppi-theme");
      else localStorage.setItem("tuppi-theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  const next: Theme = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
  return (
    <button className="iconbtn themebtn" onClick={() => setTheme(next)} title={`Theme: ${theme} (click for ${next})`} aria-label={`Theme: ${theme}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="6" />
        {theme === "dark" ? <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" /> : theme === "light" ? null : <path d="M8 2v12" />}
      </svg>
    </button>
  );
}

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!loc.hash) window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link to="/" className="brand" aria-label="tuppi home">
            <span className="cun" aria-hidden>𒁾</span>
            <span className="name">tuppi</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/texts">Texts</NavLink>
            <NavLink to="/substances">Substances</NavLink>
            <NavLink to="/rituals">Rituals</NavLink>
            <NavLink to="/browser">Browser</NavLink>
            <NavLink to="/map">Map</NavLink>
            <NavLink to="/about" className="nav-about">About</NavLink>
          </nav>
          <div className="spacer" />
          <button className="searchbtn" onClick={() => setSearchOpen(true)} aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
            <span className="lbl2">Search texts, words, substances</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeButton />
        </div>
      </header>
      <main>
        <Suspense fallback={<div className="wrap page" role="status">Loading ritual…</div>}><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/texts" element={<Texts />} />
          <Route path="/cth/:cth" element={<Composition />} />
          <Route path="/text/:id" element={<Reader />} />
          <Route path="/substances" element={<Substances />} />
          <Route path="/substance/:id" element={<SubstancePage />} />
          <Route path="/rituals" element={<RitualsIndex />} />
          <Route path="/rituals/:ritualId" element={<RitualSequence />} />
          <Route path="/rituals/:ritualId/step/:stepId" element={<RitualStepPage />} />
          <Route path="/word/:lemma" element={<WordPage />} />
          <Route path="/browser" element={<Browser />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<div className="wrap page"><h1>Not found</h1><p className="muted" style={{ marginTop: 12 }}><Link className="link" to="/">Back to the start</Link></p></div>} />
        </Routes></Suspense>
      </main>
      <footer className="foot">
        <div className="wrap">
          <span>tuppi · Hittite texts</span>
          <span>Texts: TLHdig 0.3 (CC BY 4.0) · Catalogue data: Konkordanz der hethitischen Keilschrifttafeln (CC BY-SA 4.0)</span>
          <Link to="/about">Sources &amp; method</Link>
        </div>
      </footer>
      {searchOpen && <Search onClose={() => setSearchOpen(false)} />}
    </>
  );
}
