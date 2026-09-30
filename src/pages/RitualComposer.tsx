import { ritualInterpretation } from "../lib/ritualExpression";
import { renderRitualShareImage } from "../lib/ritualShareImage";
import { compileRitualSteps, EXECUTION_VERSION } from "../lib/ritualExecution";
import { goalWordingFor, type GoalFrame } from "../lib/ritualGoal";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import compositionIndex from "../data/rituals/composition-index.json";
import aimIndex from "../data/rituals/ritual-aims.json";
import functionIndex from "../data/rituals/ritual-functions.json";
import { EPISODES, ACTION_CHAINS, THEMES, MAX_RECIPE_STEPS, episodeById, actionChainById, episodeStepIds } from "../lib/ritualSemantics";
import quoteIndex from "../data/rituals/quotes.json";
import { RITUAL_DEITIES, RITUAL_UNITS, RITUAL_VISUALS, ritualUnitHref, sourceHref, type RitualAttestation, type RitualQuote } from "../lib/ritualEdition";
import { decodeAnyRitualRecipe, encodeGrammarRecipe, encodeRitualRecipe } from "../lib/ritualShare";
import GrammarRecipe, { type GrammarState } from "../components/GrammarRecipe";
import { compileGrammarSteps } from "../lib/ritualGrammarCards";
import { imageForGrammarCard } from "../lib/ritualCardImages";
import { ATOMS, proposeRituals, type PlanItem } from "../lib/ritualPlanner";

interface Occurrence {
  unitId: string;
  ritualId: string;
  ritualName: string;
  ritualPurpose: string;
  cth: number | null;
  corpusId: string;
  sourceLabel: string;
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
interface Selection { id: string; unitId: string; reason: "matched" | "prerequisite" | "manual"; episodeId?: string; grammarId?: string; matchedTheme?: string; jevProbability?: number }
interface ComposeResponse { executionVersion?: number; goal: string; goalFrame?: GoalFrame | null; model: string; mode: "historical" | "analogy"; fit: "historical" | "clear" | "loose"; items: (Selection & { relevance: number })[] }
type Mode = ComposeResponse["mode"] | "preview" | "custom" | null;
type Fit = ComposeResponse["fit"];

const occurrences = compositionIndex as Occurrence[];
const occurrenceById = new Map(occurrences.map((item) => [`${item.ritualId}/${item.stepId}`, item]));
const occurrencesByUnit = new Map<string, Occurrence[]>();
for (const item of occurrences) occurrencesByUnit.set(item.unitId, [...(occurrencesByUnit.get(item.unitId) ?? []), item]);
const units = Object.entries(RITUAL_UNITS).sort((a, b) => a[1].title.localeCompare(b[1].title));
const aims = aimIndex as Record<string, string>;
const functions = functionIndex as Record<string, string>;
const quotes = quoteIndex as Record<string, RitualQuote[]>;
const previewIds = ["set-basket", "sleep-over", "lift-at-dawn"].map((id) => `allii/${id}`);

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

const EXAMPLE_WISHES = [
  "Make my grant application irresistible", "Let my sourdough rise", "Protect me from replying all",
  "Help me find my lost cat", "Let my bakery thrive", "Give me courage for my new job",
  "Help me make up with my sister", "Let me sleep without nightmares", "May my garden flourish",
  "Bring me a new car", "Let my crush text me back", "Give me an A in world history",
];
function pickExamples() {
  const first=Math.floor(Math.random()*EXAMPLE_WISHES.length);
  const second=(first+1+Math.floor(Math.random()*(EXAMPLE_WISHES.length-1)))%EXAMPLE_WISHES.length;
  return [EXAMPLE_WISHES[first],EXAMPLE_WISHES[second]];
}
export default function RitualComposer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [examples,setExamples]=useState(pickExamples);
  const [examplesOpen,setExamplesOpen]=useState(false);
  const [aboutOpen,setAboutOpen]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const [goal, setGoal] = useState("");
  const [appliedGoal, setAppliedGoal] = useState("");
  const [goalFrame, setGoalFrame] = useState<GoalFrame | null>(null);
  const [executionVersion, setExecutionVersion] = useState(EXECUTION_VERSION);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [fit, setFit] = useState<Fit>("clear");
  const [shared, setShared] = useState(false);
  const [imageExport, setImageExport] = useState<{ url: string; blob: Blob } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const exportRequest = useRef(0);
  useEffect(() => { setImageExport(null); exportRequest.current++; }, [selection, appliedGoal, goalFrame, executionVersion]);
  useEffect(() => () => { if (imageExport) URL.revokeObjectURL(imageExport.url); }, [imageExport]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [grammar, setGrammar] = useState<GrammarState | null>(null);
  const [alternative, setAlternative] = useState(0);
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
      const decoded = decodeAnyRitualRecipe(token);
      requestRef.current?.abort();
      if ("engine" in decoded && decoded.engine === "grammar") {
        setGoal(decoded.goal); setAppliedGoal(decoded.goal); setGoalFrame(decoded.goalFrame ?? null);
        setGrammar({ goal: decoded.goal, goalFrame: decoded.goalFrame ?? null, mode: decoded.mode, fit: decoded.fit, items: decoded.items });
        setSelection([]); setMode(decoded.mode); setFit(decoded.fit); setShared(true); setMessage("");
        return;
      }
      const recipe = decoded as Exclude<typeof decoded, { engine: "grammar" }>;
      setGrammar(null);
      setGoal(recipe.goal);
      setAppliedGoal(recipe.goal);
      setGoalFrame(recipe.goalFrame ?? null);
      setSelection(recipe.items);
      setExecutionVersion(recipe.executionVersion ?? 0);
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
    if (grammar?.items.length) {
      try { return `${window.location.origin}/r/${encodeGrammarRecipe({ goal: grammar.goal, goalFrame: grammar.goalFrame ?? undefined, mode: grammar.mode, fit: grammar.fit, items: grammar.items })}`; }
      catch { return ""; }
    }
    if (!selection.length || !appliedGoal || !mode) return "";
    try {
      const token = encodeRitualRecipe({ executionVersion: executionVersion || undefined, goal: appliedGoal, goalFrame: goalFrame ?? undefined, mode, fit, items: selection });
      return `${window.location.origin}/r/${token}`;
    } catch { return ""; }
  }, [appliedGoal, goalFrame, mode, fit, selection, executionVersion, grammar]);

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
  const executionSteps = compileRitualSteps({ items: selection, goal: appliedGoal, goalFrame: goalFrame ?? undefined, mode, executionVersion });
  const grammarCards = grammar ? compileGrammarSteps(grammar) : [];
  async function prepareShareImage() {
    const request = ++exportRequest.current;
    setExportBusy(true);
    setShareStatus("");
    try {
      const steps = grammar ? grammarCards : executionSteps;
      const actions = steps.map((step, index) => ({ step, number: index + 1 })).filter(({ step }) => step.kind === "source");
      const selected = actions.length <= 3 ? actions : [actions[0], actions[Math.floor((actions.length - 1) / 2)], actions[actions.length - 1]];
      const spoken = grammar ? (grammarCards.find(step => step.carriesWish) ?? grammarCards.find(step => step.words)) : (executionSteps.find(step => step.words && step.speechFunction === "petition") ?? executionSteps.find(step => step.words));
      const blob = await renderRitualShareImage({
        goal: goalFrame?.title ?? appliedGoal,
        actions: selected.map(({step, number}) => ({number, instruction: step.instruction, image: grammar ? imageForGrammarCard(step as import("../lib/ritualGrammarCards").GrammarCard, grammar.items) : imageFor(step.unitId)})),
        speech: spoken?.words,
        sources: grammar ? [...new Set(grammarCards.map(card => `${card.provenance.ritualName} · ${card.provenance.sourceLabel}`))] : [...new Set(selection.map(item => { const source = occurrenceById.get(item.id)!; return `${source.ritualName} · ${source.sourceLabel}`; }))],
        adapted: grammar ? grammar.mode !== "historical" : mode === "analogy" || mode === "custom",
      });
      if (request === exportRequest.current) setImageExport({blob, url: URL.createObjectURL(blob)});
    } catch (error) { if (request === exportRequest.current) setShareStatus(error instanceof Error ? error.message : "Could not export image."); }
    finally { setExportBusy(false); }
  }

  const interpretation = ritualInterpretation({items: selection, mode}, executionSteps);
  const focusedExecution = executionSteps.find((step) => step.id === focusedId);
  const composedSource = focusedExecution?.kind === 'composed' ? occurrenceById.get(focusedExecution.sourceId) : undefined;
  const focused = focusedId ? occurrenceById.get(focusedExecution?.sourceId ?? focusedId) : undefined;
  const focusedSelection = selection.find((item) => item.id === (focusedExecution?.sourceId ?? focusedId));
  const focusedEpisode = episodeById.get(focusedSelection?.episodeId ?? "");
  const focusedWording = focusedSelection && (mode === "analogy" || mode === "custom") ? goalWordingFor(focusedSelection, goalFrame) : null;
  const focusedChain = actionChainById.get(focusedSelection?.grammarId ?? "");

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

  async function compose(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
      if (data.engine === "grammar") {
        captureOrigins();
        detachSharedLink();
        setSelection([]);
        setAlternative(0);
        setGrammar({ goal: data.goal, goalFrame: data.goalFrame ?? null, mode: data.mode, fit: data.fit, items: data.items, schemaScores: data.schemaScores, aimScores: data.aimScores, scoring: data.scoring, alternatives: data.alternatives, seed: data.seed });
        setAppliedGoal(data.goal); setGoalFrame(data.goalFrame ?? null); setMode(data.mode); setFit(data.fit); setFocusedId(null);
        return;
      }
      setGrammar(null);
      const result = data as ComposeResponse;
      const validItems = result.items.filter((item) => occurrenceById.has(item.id) && occurrenceById.get(item.id)?.unitId === item.unitId);
      captureOrigins();
      detachSharedLink();
      setSelection(validItems);
      setExecutionVersion(result.executionVersion ?? EXECUTION_VERSION);
      setAppliedGoal(result.goal);
      setGoalFrame(result.goalFrame ?? null);
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
    setGoalFrame(null);
    setSelection(previewIds.map((id) => ({ id, unitId: occurrenceById.get(id)!.unitId, reason: "matched" })));
    setMode("preview");
    setFit("clear");
    setMessage("");
    setShowPreview(false);
    setFocusedId(null);
  }

  // Cycle through the server's alternatives, then re-plan locally from the same
  // structure scores. No extra model call: the judgment is reused, the draw varies.
  function anotherCombination() {
    if (!grammar) return;
    detachSharedLink();
    const next = alternative + 1;
    if (grammar.alternatives && next <= grammar.alternatives.length) {
      setAlternative(next);
      setGrammar({ ...grammar, items: grammar.alternatives[next - 1].items, mode: grammar.mode === "custom" ? "analogy" : grammar.mode });
      setMessage("");
      return;
    }
    if (grammar.actionScores) { void compose(); return; }
    if (!grammar.schemaScores) { setMessage("Compose again to draw a new combination."); return; }
    const seed = Math.floor(Math.random() * 2 ** 31);
    const proposal = proposeRituals({ schemaScores: grammar.schemaScores, aimScores: grammar.aimScores, actionScores: grammar.actionScores, seed, mode: grammar.mode === "historical" ? "historical" : "analogy" });
    setAlternative(0);
    const fresh = proposal.plans.filter((plan) => !plan.attested);
    setGrammar({ ...grammar, items: fresh[0].items, alternatives: fresh.slice(1).map((plan) => ({ items: plan.items })), seed });
  }

  function addGrammarUnit(unitId: string) {
    if (!grammar) return;
    const occurrence = (occurrencesByUnit.get(unitId) ?? [])[0];
    if (!occurrence) return;
    const atoms = ATOMS.filter((atom) => atom.ritualId === occurrence.ritualId && atom.stepId === occurrence.stepId && !grammar.items.some((item) => item.atomId === atom.id));
    if (!atoms.length) return;
    detachSharedLink();
    const added: PlanItem[] = atoms.map((atom) => ({ atomId: atom.id, schema: "arc", slot: "manual", reason: "manual" }));
    setGrammar({ ...grammar, items: [...grammar.items, ...added], mode: "custom" });
    setMode("custom");
    setMessage("Step added at the end. Its acts keep their source; spoken words are composed.");
  }

  function addUnit(unitId: string) {
    if (grammar) { addGrammarUnit(unitId); return; }
    if (selectedUnitIds.has(unitId)) return;
    const options = occurrencesByUnit.get(unitId) ?? [];
    const preferredRitual = selection[0] && occurrenceById.get(selection[0].id)?.ritualId;
    const occurrence = options.find((item) => item.ritualId === preferredRitual) ?? options[0];
    if (!occurrence) return;
    const episode = EPISODES.filter((candidate) => episodeStepIds(candidate).includes(`${occurrence.ritualId}/${occurrence.stepId}`) && !candidate.supports).sort((a, b) => a.stepIds.length - b.stepIds.length)[0];
    const chain = ACTION_CHAINS.find((candidate) => candidate.stepIds.includes(`${occurrence.ritualId}/${occurrence.stepId}`));
    const complete = episode ? episodeStepIds(episode).map((id) => occurrenceById.get(id)!) : chain ? chain.stepIds.map((id) => occurrenceById.get(id)!) : prerequisiteClosure(occurrence);
    const additions = complete.filter((item) => !selection.some((picked) => picked.id === `${item.ritualId}/${item.stepId}`));
    if (selection.length + additions.length > MAX_RECIPE_STEPS) { setMessage("A sequence can hold up to ten steps, including complete episodes."); return; }
    captureOrigins();
    detachSharedLink();
    setSelection((current) => orderSelection([...current.map(({ id, unitId, grammarId, matchedTheme }) => ({ id, unitId, reason: "manual" as const, ...(grammarId ? { grammarId, matchedTheme } : {}) })), ...additions.map((item) => ({ id: `${item.ritualId}/${item.stepId}`, unitId: item.unitId, reason: "manual" as const, ...(chain && !episode ? { grammarId: chain.id, matchedTheme: chain.themes[0] } : {}) }))]));
    setMode("custom");
    setExecutionVersion(EXECUTION_VERSION);
    setMessage(chain || episode ? "Added connected actions." : "Step added.");
  }

  function removeStep(id: string) {
    detachSharedLink();
    const picked = selection.find((item) => item.id === id);
    const episodeId = picked?.episodeId;
    const grammarId = picked?.grammarId;
    const removed = new Set(episodeId || grammarId ? selection.filter((item) => item.episodeId === episodeId && item.grammarId === grammarId).map((item) => item.id) : [id]);
    // A closing libation cannot survive deletion of its supporting cleansing episode.
    if (episodeById.get(episodeId ?? "")?.role === "cleansing") {
      selection.filter((item) => episodeById.get(item.episodeId ?? "")?.supports === "cleansing").forEach((item) => removed.add(item.id));
    }
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
    setMessage(episodeId || grammarId ? "Removed the connected actions." : "Step removed.");
    setMode("custom");
    setExecutionVersion(EXECUTION_VERSION);
    if (focusedId && (removed.has(focusedId) || (focusedExecution && removed.has(focusedExecution.sourceId)))) setFocusedId(null);
  }

  return <div className="wrap page ritual-page ritual-composer-page">
    <h1 className="ritual-composer-title">Create your own Hittite ritual</h1>
    <form className="ritual-composer-search" onSubmit={compose}>
      <label className="sr" htmlFor="ritual-goal">What would you like your ritual to achieve?</label>
      <div className={`ritual-example-help${examplesOpen?" open":""}`} onMouseEnter={()=>{if(!examplesOpen)setExamples(pickExamples());setExamplesOpen(true);}} onMouseLeave={()=>setExamplesOpen(false)} onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget))setExamplesOpen(false);}}>
        <button type="button" className="ritual-example-icon" onPointerDown={event=>event.preventDefault()} aria-label="Example wishes" aria-expanded={examplesOpen} aria-controls="ritual-examples" onFocus={()=>{if(!examplesOpen)setExamples(pickExamples());setExamplesOpen(true);}} onClick={()=>setExamplesOpen(true)} onKeyDown={event=>{if(event.key==="Escape"){setExamplesOpen(false);inputRef.current?.focus();}}}>?</button>
        <div id="ritual-examples" className="ritual-example-tooltip" hidden={!examplesOpen}><small>A little inspiration</small>{examples.map(example=><button type="button" key={example} onPointerDown={event=>event.preventDefault()} onClick={()=>{setGoal(example);setExamplesOpen(false);inputRef.current?.focus();}}>{example} <span aria-hidden="true">↗</span></button>)}</div>
      </div>
      <input ref={inputRef} id="ritual-goal" autoComplete="off" value={goal} maxLength={160} onChange={(event) => setGoal(event.target.value)} placeholder="What would you like your ritual to achieve?" />
      {goal && <button className="ritual-composer-clear" type="button" aria-label="Clear goal" onClick={() => setGoal("")}>×</button>}
      <button className="ritual-composer-submit" type="submit" disabled={busy} aria-label="Compose ritual">{busy ? <span className="ritual-composer-spinner" /> : <span aria-hidden="true">→</span>}</button>
    </form>
    <div className="ritual-composer-about">
      <button type="button" className="ritual-composer-about-trigger" aria-expanded={aboutOpen} aria-controls="ritual-composer-about-text" onClick={()=>setAboutOpen(value=>!value)}>What is this?</button>
      <div id="ritual-composer-about-text" className={`ritual-composer-about-panel${aboutOpen?" is-open":""}`} inert={!aboutOpen} aria-hidden={!aboutOpen}>
        <div className="ritual-composer-about-inner"><div className="ritual-composer-about-copy">
          <p>This website is an experimental platform for surfacing ancient texts relating to medicine, disease, drugs and nature, ideated by <a href="https://resobscura.substack.com" target="_blank" rel="noopener noreferrer">Benjamin Breen</a> and created by GPT-6 and Opus 5.5.</p>
          <p>My real goal here is to test how frontier AI models can contribute to identifying ancient plants, animals, and recipes, but since a lot of this corpus involves magical rituals, I thought it would be fun to experiment with <a href="https://docs.typesafe.ai/introduction" target="_blank" rel="noopener noreferrer">Jev</a> to create a “make your own ritual” feature.</p>
          <p>Enjoy, and may Šamaš smile upon you!</p>
        </div></div>
      </div>
    </div>
    <div className="ritual-composer-feedback" role="status" aria-live="polite">
      {busy ? "Composing ritual…" : message}
      {showPreview && <button type="button" onClick={preview}>Preview with “undo a curse”</button>}
    </div>

    <section className={`ritual-composer-result${selection.length ? "" : " empty"}`} aria-label="Selected ritual steps">
      {(selection.length > 0 || !!grammar?.items.length) && <div className="ritual-composer-result-head">
        <span>{mode === "historical" ? "Ritual for a historical aim" : mode === "analogy" ? (fit === "loose" ? "Loose analogy" : "Ritual for your goal") : mode === "preview" ? "Example ritual" : "Your edited ritual"}</span>
        {appliedGoal && <small>For “{appliedGoal}”</small>}
        {shared && <em className="ritual-composer-shared">Shared recipe</em>}
        <div className="ritual-composer-actions">{grammar && <button type="button" onClick={anotherCombination}>Another combination ↻</button>}<button className="ritual-composer-share-trigger" type="button" onClick={() => { setShareOpen((value) => !value); setShareStatus(""); }} aria-expanded={shareOpen}>Share ritual ↗</button><button type="button" onClick={() => { detachSharedLink(); setSelection([]); setGrammar(null); setMode(null); setFocusedId(null); }}>Clear sequence</button></div>
      </div>}
      {shareOpen && shareUrl && <div className="ritual-composer-share" role="dialog" aria-label="Share this ritual">
        <button className="ritual-composer-share-close" type="button" aria-label="Close share options" onClick={() => setShareOpen(false)}>×</button>

        <h2>Share this ritual</h2>
        <p>Copy the full ritual link or save an image with selected steps and spoken words.</p>
        <div className="ritual-composer-share-url"><input readOnly aria-label="Share link" value={shareUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={copyShareLink}>Copy link</button></div>
        <div className="ritual-composer-share-links"><a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(goalFrame?.title ?? `A ritual for ${appliedGoal}`)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">Post to X ↗</a><a href={`https://bsky.app/intent/compose?text=${encodeURIComponent(`${goalFrame?.title ?? `A ritual for ${appliedGoal}`} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer">Post to Bluesky ↗</a>{typeof navigator.share === "function" && <button type="button" onClick={() => navigator.share({ title: goalFrame?.title ?? `A ritual for ${appliedGoal}`, url: shareUrl }).catch(() => {})}>More options ↗</button>}</div>
        <div className="ritual-share-export">
          <button type="button" disabled={exportBusy} onClick={prepareShareImage}>{exportBusy ? "Preparing image…" : imageExport ? "Refresh image" : "Create image"}</button>
          {imageExport && <>
            <a href={imageExport.url} download="tuppi-ritual.png">Download PNG</a>
            {typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([imageExport.blob], "tuppi-ritual.png", {type: "image/png"})] }) && <button type="button" onClick={() => navigator.share({files: [new File([imageExport.blob], "tuppi-ritual.png", {type: "image/png"})], text: appliedGoal, url: shareUrl}).catch(error => { if (error.name !== "AbortError") setShareStatus("Could not share image. Download the PNG instead."); })}>Share image ↗</button>}
            <img src={imageExport.url} alt={`Share image for ${appliedGoal}: selected ritual actions and spoken words`} />
          </>}
        </div>
        <span className="ritual-composer-share-status" role="status">{shareStatus}</span>
      </div>}
      {grammar && <GrammarRecipe state={grammar} onItems={(items) => { detachSharedLink(); setGrammar({ ...grammar, items, mode: "custom" }); setMode("custom"); setMessage(items.length ? "Card removed." : ""); if (!items.length) setGrammar(null); }} />}
      {!grammar && goalFrame && <div className="ritual-composer-wish"><p>{goalFrame.wish}</p></div>}
      {!grammar && selection.length > 0 && interpretation && <div className="ritual-composer-logic">
        <p className="ritual-eyebrow">{interpretation.title}</p>
        <p>{interpretation.explanation}</p>
        {interpretation.sourceId && <Link to={`/rituals/${interpretation.sourceId.split('/')[0]}/step/${interpretation.sourceId.split('/')[1]}`}>Source passage ↗</Link>}
      </div>}
      {!grammar && <div className="ritual-composer-selection" ref={selectionRef}>
        {executionSteps.map((step, index) => {
          const picked = selection.find((item) => item.id === step.sourceId)!;
          const item = occurrenceById.get(step.sourceId)!;
          return <div className={`ritual-composer-picked${step.kind === "composed" ? " ritual-composer-speech" : ""}`} data-unit-id={step.kind === "source" ? picked.unitId : undefined} key={step.id}>
            <button className="ritual-composer-picked-main" type="button" onClick={() => setFocusedId(focusedId === step.id ? null : step.id)} aria-expanded={focusedId === step.id}>
              {step.kind === "composed" ? <>
                <span className="ritual-composer-speech-heading"><b>{index + 1}</b>{step.title ?? (step.accompanies ? "At the threshold" : step.establishes ? "Opening petition" : "Closing petition")}</span>
                <span className="ritual-composer-card-words">“{step.words}”</span>
                <small className="ritual-composer-composed-label">Composed words</small>
              </> : <>
                <span className="ritual-composer-image"><img src={imageFor(step.unitId)} alt="" /></span>
                <span className="ritual-composer-picked-title"><b>{index + 1}</b>{step.instruction}</span>
              </>}
            </button>
            {(step.kind === "source" || step.replacesSource) && <button className="ritual-composer-remove" type="button" aria-label={picked.episodeId ? `Remove connected episode: ${episodeById.get(picked.episodeId)?.title}` : picked.grammarId ? `Remove connected actions` : `Remove ${item.stepTitle}`} onClick={() => removeStep(picked.id)}>×</button>}
          </div>;
        })}
      </div>}
      {!grammar && focusedExecution?.kind === "composed" && <div className="ritual-composer-detail" aria-label="Composed ritual step">
        <button className="ritual-composer-detail-close" type="button" aria-label="Close details" onClick={() => setFocusedId(null)}>×</button>
        <div><p className="ritual-eyebrow">Composed for this ritual</p><h2>{focusedExecution.instruction}</h2><p>{focusedExecution.note}</p></div>
        <div><p className="ritual-eyebrow">Spoken words</p><blockquote>“{focusedExecution.words}”</blockquote><p>Addressee: {focusedExecution.addressee ?? "ritual participant"}. These words are a modern adaptation.</p></div>
        <div><p className="ritual-eyebrow">Why this step is here</p><p>{focusedExecution.speechFunction ? `These words serve ${focusedExecution.speechFunction}; their imagery follows the linked source passage.` : focusedExecution.accompanies ? "Speak these words during the action shown on the preceding card." : focusedExecution.establishes ? "The following action requires the practitioner to be speaking. This opening establishes that activity." : "This finishes the spoken petition after the action it accompanies."} This companion stays attached to its source action; removing that action rebuilds the speech sequence.</p>{composedSource && <Link to={`/rituals/${composedSource.ritualId}/step/${composedSource.stepId}`}>Source action that prompted this addition ↗</Link>}</div>
      {focusedExecution.evidence && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Source passage · draft translation</p><blockquote>{focusedExecution.evidence.text}</blockquote><small>{focusedExecution.evidence.translator}. The wording on the card is newly composed.</small></div>}</div>}
      {!grammar && focused && <div className="ritual-composer-detail" aria-label="Original source context">
        <button className="ritual-composer-detail-close" type="button" aria-label="Close details" onClick={() => setFocusedId(null)}>×</button>
        <div><p className="ritual-eyebrow">{focused.ritualName} · {focused.sourceLabel} · step {focused.stepNumber}</p><h2>{focused.stepTitle}</h2><p>{focused.summary}</p>{focusedExecution?.note && <p>{focusedExecution.note}</p>}</div>
        <div><p className="ritual-eyebrow">Original context</p><p>{focused.ritualPurpose}</p><p className="ritual-composer-context">{focused.aims.map((aim) => aims[aim]).join(" ")} {functions[focused.function]}</p></div>
        <div><p className="ritual-eyebrow">From the text</p>{quotes[`${focused.ritualId}/${focused.stepId}`]?.find((quote) => quote.english)?.english && <blockquote>“{quotes[`${focused.ritualId}/${focused.stepId}`].find((quote) => quote.english)!.english}”</blockquote>}
          {!quotes[`${focused.ritualId}/${focused.stepId}`]?.some((quote) => quote.english) && quotes[`${focused.ritualId}/${focused.stepId}`]?.[0]?.original && <><p className="ritual-composer-context">Original-language wording; the English summary above is editorial.</p><blockquote>{quotes[`${focused.ritualId}/${focused.stepId}`][0].original}</blockquote></>}
          <div className="ritual-composer-links"><Link to={`/rituals/${focused.ritualId}/step/${focused.stepId}`}>Open step ↗</Link><Link to={ritualUnitHref(focused.unitId)}>Task across rituals ↗</Link>{focused.source[0] && <Link to={sourceHref(focused.source[0])}>Read tablet ↗</Link>}</div>
        </div>
        {focusedWording && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Adapted words for your wish</p><p>“{focusedWording.words}”</p><small>{focusedWording.note} These words are newly composed, not a quotation from the tablet.</small></div>}
        {focusedEpisode && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Why these acts belong together</p><p>{focusedEpisode.historicalLogic}</p></div>}
        {focusedChain && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">How these actions connect</p><p>{focusedChain.historicalLogic}</p></div>}
        {(mode === "analogy" || mode === "custom") && focusedEpisode && <div className="ritual-composer-symbolic"><p className="ritual-eyebrow">Reading “{appliedGoal}”</p><p>{THEMES[focusedSelection?.matchedTheme ?? "general"]?.reading}</p></div>}
        {typeof focusedSelection?.jevProbability === "number" && <details className="ritual-composer-decision">
          <summary>Jev’s assessment of {focusedEpisode || focusedChain ? "these connected actions" : "this act"}</summary>
          <p>{Math.round(focusedSelection.jevProbability * 100)}% match estimate for this sequence.</p>
        </details>}
        {focusedSelection?.reason === "manual" && <p className="ritual-composer-decision ritual-composer-decision-manual">Added manually · no Jev score for this step.</p>}
      </div>}
    </section>

    <section className="ritual-composer-library" aria-labelledby="ritual-composer-library-heading">
      <div className="ritual-composer-library-head"><h2 id="ritual-composer-library-heading">Ritual tasks</h2><span>{shownUnits.length} tasks</span><label><span className="sr">Filter ritual tasks</span><input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tasks…" /></label></div>
      <div className="ritual-composer-grid">
        {shownUnits.map(([unitId, unit]) => <button className="ritual-composer-task" data-unit-id={unitId} data-selected={selectedUnitIds.has(unitId) || undefined} key={unitId} type="button" disabled={!grammar && selectedUnitIds.has(unitId)} onClick={() => addUnit(unitId)} aria-label={`${selectedUnitIds.has(unitId) ? "Selected" : "Add"} ${unit.title}`}>
          <span className="ritual-composer-image"><img src={imageFor(unitId)} alt="" loading="lazy" /></span><span>{unit.title}</span>
        </button>)}
      </div>
      {!shownUnits.length && <p className="ritual-composer-empty">No ritual tasks match this filter.</p>}
    </section>
  </div>;
}
