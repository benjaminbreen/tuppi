import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import compositionIndex from "../data/rituals/composition-index.json";
import aimIndex from "../data/rituals/ritual-aims.json";
import functionIndex from "../data/rituals/ritual-functions.json";
import analogyIndex from "../data/rituals/ritual-analogies.json";
import quoteIndex from "../data/rituals/quotes.json";
import { RITUAL_DEITIES, RITUAL_UNITS, RITUAL_VISUALS, ritualUnitHref, sourceHref, type RitualAttestation, type RitualQuote } from "../lib/ritualEdition";
import { decodeRitualRecipe, encodeRitualRecipe } from "../lib/ritualShare";

interface Occurrence {
  unitId: string;
  ritualId: string;
  ritualName: string;
  ritualPurpose: string;
  cth: number;
  stepId: string;
  stepNumber: number;
  stepTitle: string;
  summary: string;
  phase: string;
  function: string;
  aims: string[];
  requires: string[];
  materials: string[];
  recipient: string | null;
  source: RitualAttestation[];
}
interface Selection { id: string; unitId: string; reason: "matched" | "prerequisite" | "manual"; jevProbability?: number }
interface ComposeResponse { goal: string; model: string; mode: "historical" | "analogy"; fit: "historical" | "clear" | "loose"; items: (Selection & { relevance: number })[] }
type Mode = ComposeResponse["mode"] | "preview" | "custom" | null;
type Fit = ComposeResponse["fit"];

const occurrences = compositionIndex as Occurrence[];
const occurrenceById = new Map(occurrences.map((item) => [`${item.ritualId}/${item.stepId}`, item]));
const occurrencesByUnit = new Map<string, Occurrence[]>();
for (const item of occurrences) occurrencesByUnit.set(item.unitId, [...(occurrencesByUnit.get(item.unitId) ?? []), item]);
const units = Object.entries(RITUAL_UNITS).sort((a, b) => a[1].title.localeCompare(b[1].title));
const aims = aimIndex as Record<string, string>;
const functions = functionIndex as Record<string, string>;
const analogies = analogyIndex as { functions: Record<string, { role: string; lenses: string[]; historicalOnly?: boolean }> };
const quotes = quoteIndex as Record<string, RitualQuote[]>;
const previewIds = ["arrange-figures", "seat-patient", "raise-vessel", "return-address", "wind-wool", "set-basket"].map((id) => `allii/${id}`);

function imageFor(unitId: string) {
  const unit = RITUAL_UNITS[unitId];
  return unit.deityVisualId ? RITUAL_DEITIES[unit.deityVisualId].src : RITUAL_VISUALS[unit.visualAssetId].src;
}

function messageFor(code: string) {
  switch (code) {
    case "jev_not_configured": return "Jev is not connected yet. You can preview the interaction with an example sequence.";
    case "jev_auth_failed": return "The Jev key was rejected. Check the server configuration and try again.";
    case "rate_limited": case "jev_rate_limited": return "Too many requests right now. Please try again shortly.";
    case "invalid_goal": return "Enter a goal between 3 and 160 characters.";
    default: return "The recommendation service is unavailable right now. Please try again.";
  }
}

function prerequisiteClosure(item: Occurrence, seen = new Set<string>()): Occurrence[] {
  const id = `${item.ritualId}/${item.stepId}`;
  if (seen.has(id)) return [];
  seen.add(id);
  return [...item.requires.flatMap((stepId) => {
    const required = occurrenceById.get(`${item.ritualId}/${stepId}`);
    return required ? prerequisiteClosure(required, seen) : [];
  }), item];
}

function orderSelection(items: Selection[]): Selection[] {
  const pending = [...items];
  const ordered: Selection[] = [];
  while (pending.length) {
    const nextIndex = pending.findIndex((candidate) => !pending.some((other) => {
      if (candidate.id === other.id) return false;
      const step = occurrenceById.get(candidate.id)!;
      const prior = occurrenceById.get(other.id)!;
      return step.ritualId === prior.ritualId && prior.stepNumber < step.stepNumber;
    }));
    if (nextIndex < 0) return items;
    ordered.push(pending.splice(nextIndex, 1)[0]);
  }
  return ordered;
}

export default function RitualComposer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const [appliedGoal, setAppliedGoal] = useState("");
  const [selection, setSelection] = useState<Selection[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [fit, setFit] = useState<Fit>("clear");
  const [shared, setShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [filter, setFilter] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const origins = useRef(new Map<string, DOMRect>());
  const selectionRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("recipe");
    if (!token) return;
    try {
      const recipe = decodeRitualRecipe(token);
      requestRef.current?.abort();
      setGoal(recipe.goal);
      setAppliedGoal(recipe.goal);
      setSelection(recipe.items);
      setMode(recipe.mode);
      setFit(recipe.fit);
      setFocusedId(null);
      setShared(true);
      setMessage("");
    } catch {
      setMessage("This shared ritual link could not be opened.");
    }
  }, [location.search]);

  const shareUrl = useMemo(() => {
    if (!selection.length || !appliedGoal || !mode) return "";
    try {
      const token = encodeRitualRecipe({ goal: appliedGoal, mode, fit, items: selection });
      return `${window.location.origin}/r/${token}`;
    } catch { return ""; }
  }, [appliedGoal, mode, fit, selection]);

  function detachSharedLink() {
    if (location.search) navigate("/rituals/create", { replace: true });
    setShared(false);
    setShareOpen(false);
    setShareStatus("");
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Link copied");
    } catch { setShareStatus("Select and copy the link below."); }
  }

  const shownUnits = useMemo(() => {
    const words = filter.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return units.filter(([id, unit]) => words.every((word) => `${id} ${unit.title} ${unit.description}`.toLocaleLowerCase().includes(word)));
  }, [filter]);
  const selectedUnitIds = useMemo(() => new Set(selection.map((item) => item.unitId)), [selection]);
  const focused = focusedId ? occurrenceById.get(focusedId) : undefined;
  const focusedSelection = selection.find((item) => item.id === focusedId);

  const captureOrigins = () => {
    origins.current.clear();
    document.querySelectorAll<HTMLElement>(".ritual-composer-task[data-unit-id]").forEach((card) => {
      if (card.dataset.unitId) origins.current.set(card.dataset.unitId, card.getBoundingClientRect());
    });
  };

  useLayoutEffect(() => {
    if (!origins.current.size || !selectionRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { origins.current.clear(); return; }
    const animations: Animation[] = [];
    selectionRef.current.querySelectorAll<HTMLElement>(".ritual-composer-picked[data-unit-id]").forEach((card, index) => {
      const from = origins.current.get(card.dataset.unitId ?? "");
      if (!from) return;
      const to = card.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      animations.push(card.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${Math.min(1.2, from.width / to.width)})`, opacity: 0.45 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ], { duration: 550 + index * 55, easing: "cubic-bezier(.2,.8,.2,1)" }));
    });
    origins.current.clear();
    return () => animations.forEach((animation) => animation.cancel());
  }, [selection]);

  async function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedGoal = goal.trim().replace(/\s+/g, " ");
    if (requestedGoal.length < 3 || requestedGoal.length > 160) { setMessage("Enter a goal between 3 and 160 characters."); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setMessage("");
    setShowPreview(false);
    try {
      const response = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: requestedGoal }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(messageFor(data.error));
        setShowPreview(data.error === "jev_not_configured");
        return;
      }
      const result = data as ComposeResponse;
      const validItems = result.items.filter((item) => occurrenceById.has(item.id) && occurrenceById.get(item.id)?.unitId === item.unitId);
      captureOrigins();
      detachSharedLink();
      setSelection(validItems.map(({ id, unitId, reason, jevProbability }) => ({ id, unitId, reason, jevProbability })));
      setAppliedGoal(result.goal);
      setMode(result.mode);
      setFit(result.fit);
      setFocusedId(null);
      if (!validItems.length) setMessage("No convincing connection emerged from the current ritual texts. Try a different goal.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessage("The recommendation service is unavailable right now. Please try again.");
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }

  function preview() {
    captureOrigins();
    detachSharedLink();
    setGoal("undo a curse");
    setAppliedGoal("undo a curse");
    setSelection(previewIds.map((id) => ({ id, unitId: occurrenceById.get(id)!.unitId, reason: "matched" })));
    setMode("preview");
    setFit("clear");
    setMessage("");
    setShowPreview(false);
    setFocusedId(null);
  }

  function addUnit(unitId: string) {
    if (selectedUnitIds.has(unitId)) return;
    const options = occurrencesByUnit.get(unitId) ?? [];
    const preferredRitual = selection[0] && occurrenceById.get(selection[0].id)?.ritualId;
    const occurrence = options.find((item) => item.ritualId === preferredRitual) ?? options[0];
    if (!occurrence) return;
    const additions = prerequisiteClosure(occurrence).filter((item) => !selection.some((picked) => picked.id === `${item.ritualId}/${item.stepId}`));
    if (selection.length + additions.length > 6) { setMessage("A sequence can hold up to six steps, including prerequisites."); return; }
    const combinedUnits = [...selection.map((item) => item.unitId), ...additions.map((item) => item.unitId)];
    if (new Set(combinedUnits).size !== combinedUnits.length) { setMessage("That task is already represented in this sequence."); return; }
    captureOrigins();
    detachSharedLink();
    setSelection((current) => orderSelection([...current, ...additions.map((item) => ({ id: `${item.ritualId}/${item.stepId}`, unitId: item.unitId, reason: "manual" as const }))]));
    setMode("custom");
    setMessage("");
  }

  function removeStep(id: string) {
    detachSharedLink();
    const removed = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const picked of selection) {
        const item = occurrenceById.get(picked.id);
        if (item?.requires.some((stepId) => removed.has(`${item.ritualId}/${stepId}`)) && !removed.has(picked.id)) {
          removed.add(picked.id);
          changed = true;
        }
      }
    }
    setSelection((current) => current.filter((item) => !removed.has(item.id)));
    setMode("custom");
    if (focusedId && removed.has(focusedId)) setFocusedId(null);
  }

  return <div className="wrap page ritual-page ritual-composer-page">
    <h1 className="sr">Create your own ritual</h1>
    <form className="ritual-composer-search" onSubmit={compose}>
      <label className="sr" htmlFor="ritual-goal">What should this ritual address?</label>
      <input id="ritual-goal" autoComplete="off" value={goal} maxLength={160} onChange={(event) => setGoal(event.target.value)} placeholder="What should this ritual address?" />
      {goal && <button className="ritual-composer-clear" type="button" aria-label="Clear goal" onClick={() => setGoal("")}>×</button>}
      <button className="ritual-composer-submit" type="submit" disabled={busy} aria-label="Compose ritual">{busy ? <span className="ritual-composer-spinner" /> : <span aria-hidden="true">→</span>}</button>
    </form>
    <div className="ritual-composer-feedback" role="status" aria-live="polite">
      {busy ? "Matching ritual tasks…" : message}
      {showPreview && <button type="button" onClick={preview}>Preview with “undo a curse”</button>}
    </div>

    <section className={`ritual-composer-result${selection.length ? "" : " empty"}`} aria-label="Selected ritual steps">
      {selection.length > 0 && <div className="ritual-composer-result-head">
        <span>{mode === "historical" ? "Historical aim match" : mode === "analogy" ? fit === "loose" ? "Loose creative analogy · not an attested use" : "Creative analogy · not an attested use" : mode === "preview" ? "Example preview · Jev not connected" : "Your edited sequence"}</span>
        {appliedGoal && <small>For “{appliedGoal}”</small>}
        {shared && <em className="ritual-composer-shared">Shared recipe</em>}
        <div className="ritual-composer-actions"><button className="ritual-composer-share-trigger" type="button" onClick={() => { setShareOpen((value) => !value); setShareStatus(""); }} aria-expanded={shareOpen}>Share ritual ↗</button><button type="button" onClick={() => { detachSharedLink(); setSelection([]); setMode(null); setFocusedId(null); }}>Clear sequence</button></div>
      </div>}
      {shareOpen && shareUrl && <div className="ritual-composer-share" role="dialog" aria-label="Share this ritual">
        <button className="ritual-composer-share-close" type="button" aria-label="Close share options" onClick={() => setShareOpen(false)}>×</button>
        <p className="ritual-eyebrow">A recipe with a permanent link</p>
        <h2>Share this ritual</h2>
        <p>The link restores this goal, these steps, their order, and Jev’s match estimates. Anyone can open it without an API key.</p>
        <div className="ritual-composer-share-url"><input readOnly aria-label="Share link" value={shareUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={copyShareLink}>Copy link</button></div>
        <div className="ritual-composer-share-links"><a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`A Hittite ritual for ${appliedGoal}`)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">Post to X ↗</a><a href={`https://bsky.app/intent/compose?text=${encodeURIComponent(`A Hittite ritual for ${appliedGoal} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer">Post to Bluesky ↗</a>{typeof navigator.share === "function" && <button type="button" onClick={() => navigator.share({ title: `A ritual for ${appliedGoal}`, url: shareUrl }).catch(() => {})}>More options ↗</button>}</div>
        <span className="ritual-composer-share-status" role="status">{shareStatus}</span>
      </div>}
      <div className="ritual-composer-selection" ref={selectionRef}>
        {selection.map((picked, index) => {
          const item = occurrenceById.get(picked.id)!;
          return <div className="ritual-composer-picked" data-unit-id={picked.unitId} key={picked.id}>
            <button className="ritual-composer-picked-main" type="button" onClick={() => setFocusedId(focusedId === picked.id ? null : picked.id)} aria-expanded={focusedId === picked.id}>
              <span className="ritual-composer-image"><img src={imageFor(picked.unitId)} alt="" /></span>
              <span className="ritual-composer-picked-title"><b>{index + 1}</b>{item.stepTitle}</span>
            </button>
            <button className="ritual-composer-remove" type="button" aria-label={`Remove ${item.stepTitle}`} onClick={() => removeStep(picked.id)}>×</button>
          </div>;
        })}
      </div>
      {focused && <div className="ritual-composer-detail" aria-label="Original source context">
        <button className="ritual-composer-detail-close" type="button" aria-label="Close details" onClick={() => setFocusedId(null)}>×</button>
        <div><p className="ritual-eyebrow">{focused.ritualName} · CTH {focused.cth} · step {focused.stepNumber}</p><h2>{focused.stepTitle}</h2><p>{focused.summary}</p></div>
        <div><p className="ritual-eyebrow">Original context</p><p>{focused.ritualPurpose}</p><p className="ritual-composer-context">{focused.aims.map((aim) => aims[aim]).join(" ")} {functions[focused.function]}</p></div>
        <div><p className="ritual-eyebrow">From the text</p>{quotes[`${focused.ritualId}/${focused.stepId}`]?.find((quote) => quote.english)?.english && <blockquote>“{quotes[`${focused.ritualId}/${focused.stepId}`].find((quote) => quote.english)!.english}”</blockquote>}
          <div className="ritual-composer-links"><Link to={`/rituals/${focused.ritualId}/step/${focused.stepId}`}>Open step ↗</Link><Link to={ritualUnitHref(focused.unitId)}>Task across rituals ↗</Link>{focused.source[0] && <Link to={sourceHref(focused.source[0])}>Read tablet ↗</Link>}</div>
        </div>
        {mode !== "historical" && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Creative reading for this goal</p><p>{analogies.functions[focused.function]?.role}</p><small>This is a modern analogy drawn from the act’s documented role, not an attested Hittite use.</small></div>}
        {typeof focusedSelection?.jevProbability === "number" && <div className="ritual-composer-decision">
          <div className="ritual-composer-decision-score"><span>Jev thematic match</span><strong>{Math.round(focusedSelection.jevProbability * 100)}%</strong></div>
          <div className="ritual-composer-decision-copy"><p>Jev’s estimate that this act has a meaningful connection to “{appliedGoal}” through its original aim or a specific symbolic analogy. It does not measure whether the ritual works.</p>
            {focusedSelection.reason === "prerequisite" && <p>This step was included because a later selected step requires it in the source ritual.</p>}
          </div>
        </div>}
        {focusedSelection?.reason === "manual" && <p className="ritual-composer-decision ritual-composer-decision-manual">Added manually · no Jev score for this step.</p>}
      </div>}
    </section>

    <section className="ritual-composer-library" aria-labelledby="ritual-composer-library-heading">
      <div className="ritual-composer-library-head"><h2 id="ritual-composer-library-heading">Ritual tasks</h2><span>{shownUnits.length} tasks</span><label><span className="sr">Filter ritual tasks</span><input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tasks…" /></label></div>
      <div className="ritual-composer-grid">
        {shownUnits.map(([unitId, unit]) => <button className="ritual-composer-task" data-unit-id={unitId} data-selected={selectedUnitIds.has(unitId) || undefined} key={unitId} type="button" disabled={selectedUnitIds.has(unitId)} onClick={() => addUnit(unitId)} aria-label={`${selectedUnitIds.has(unitId) ? "Selected" : "Add"} ${unit.title}`}>
          <span className="ritual-composer-image"><img src={imageFor(unitId)} alt="" loading="lazy" /></span><span>{unit.title}</span>
        </button>)}
      </div>
      {!shownUnits.length && <p className="ritual-composer-empty">No ritual tasks match this filter.</p>}
    </section>
  </div>;
}
