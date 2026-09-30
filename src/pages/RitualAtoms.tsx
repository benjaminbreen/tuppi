import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ATOMS, atomById, type AtomRecord } from "../lib/ritualPlanner";
import { GRAMMAR, realizeAtom } from "../lib/ritualAtoms";

// The atom layer as a comparative index: one row per signature (verb + object
// class, or speech act), listing every occurrence across rituals and traditions.
const TRADITION: Record<string, string> = { "tlhdig-hittite": "Ḫattuša", cmawro: "Mesopotamia" };

export default function RitualAtoms() {
  const [params, setParams] = useSearchParams();
  const focusAtom = atomById.get(params.get("q") ?? "");
  const [filter, setFilter] = useState(focusAtom?.signature ?? "");
  const [sort, setSort] = useState<"spread" | "alpha">("spread");
  const groups = useMemo(() => {
    const map = new Map<string, AtomRecord[]>();
    for (const atom of ATOMS) map.set(atom.signature, [...(map.get(atom.signature) ?? []), atom]);
    return [...map.entries()].map(([signature, atoms]) => ({
      signature, atoms,
      rituals: new Set(atoms.map((a) => a.ritualId)).size,
      traditions: new Set(atoms.map((a) => a.corpusId)),
    }));
  }, []);
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = groups.filter((group) => words.every((word) => `${group.signature} ${group.atoms.map((a) => `${a.ritualName} ${a.stepTitle} ${a.atom.theme?.sub ?? ""}`).join(" ")}`.toLowerCase().includes(word)))
    .sort((a, b) => sort === "alpha" ? a.signature.localeCompare(b.signature) : b.rituals - a.rituals || b.atoms.length - a.atoms.length);
  const shared = groups.filter((group) => group.rituals > 1).length;
  const crossing = groups.filter((group) => group.traditions.size > 1).length;

  return <div className="wrap page ritual-page ritual-atoms-page">
    <header className="ritual-units-index-head">
      <h1>Ritual grammar</h1>
      <p>Every step broken into its smallest acts: a verb, the thing it acts on, and its roles. {ATOMS.length} atoms fall into {groups.length} signatures; {shared} recur in more than one ritual, and {crossing} cross between Ḫattuša and Mesopotamia. A shared signature means the same kind of act, not the same meaning.</p>
    </header>
    <div className="ritual-atoms-controls">
      <label><span className="sr">Filter atoms</span><input type="search" value={filter} onChange={(event) => { setFilter(event.target.value); if (params.get("q")) setParams({}, { replace: true }); }} placeholder="Filter: speak:dismissal, burn(figure), ram…" /></label>
      <label>Sort <select value={sort} onChange={(event) => setSort(event.target.value as "spread" | "alpha")}><option value="spread">most widespread</option><option value="alpha">A–Z</option></select></label>
      <span>{shown.length} signatures</span>
    </div>
    <ul className="ritual-atoms-list">
      {shown.map((group) => {
        const [verb, rest] = group.signature.split(/[(:]/);
        const gloss = verb === "speak" ? GRAMMAR.speechActs[rest] : GRAMMAR.verbs[verb]?.gloss;
        return <li key={group.signature} className={group.atoms.some((a) => a.id === focusAtom?.id) ? "is-focus" : ""}>
          <details open={group.atoms.some((a) => a.id === focusAtom?.id) || shown.length < 4}>
            <summary>
              <code>{group.signature}</code>
              <span className="ritual-atoms-gloss">{gloss}</span>
              <span className="ritual-atoms-count">{group.rituals} {group.rituals === 1 ? "ritual" : "rituals"}{group.traditions.size > 1 ? " · both traditions" : ""}</span>
            </summary>
            <ol>
              {group.atoms.map((atom) => <li key={atom.id} className={atom.id === focusAtom?.id ? "is-focus" : ""}>
                <span className="ritual-atoms-realized">{realizeAtom(atom.atom)}</span>
                <Link to={`/rituals/${atom.ritualId}/step/${atom.stepId}`}>{atom.ritualName} · step {atom.stepNumber}: {atom.stepTitle}</Link>
                <small>{TRADITION[atom.corpusId] ?? atom.corpusId}</small>
              </li>)}
            </ol>
          </details>
        </li>;
      })}
    </ul>
  </div>;
}
