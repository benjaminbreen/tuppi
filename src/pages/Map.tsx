import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Kwic, { type KwicRow } from "../components/Kwic";
import { useData, useIndex } from "../lib/data";

type Per = "OS" | "MS" | "NS" | "LNS" | "?";
type Conf = "site" | "proposed" | "region" | "river" | "offmap";
interface Place {
  id: string; key: string; name: string; kind: "city" | "land" | "river" | "mountain"; conf: Conf | null;
  n: number; t: number; per: Partial<Record<Per, number>>; sl: Partial<Record<Per, number>>;
  docs: [string, string, Per, number][]; lat?: number; lon?: number; note?: string; wd?: string | null;
  x?: number; y?: number; edge?: number; att?: KwicRow[]; lem: string[];
}
interface Edge { a: string; b: string; t: number; per: Partial<Record<Per, number>> }
interface Origin { cth: string; who: string; from: string; n: number }
interface MapData {
  w: number; h: number; land: string; lakes: string; rivers: string; places: Place[]; edges: Edge[]; origins: Origin[];
  periodDocs: Record<Per, number>; ndocs: number; window: number;
}

const STOPS: { id: "all" | Per; label: string; sub: string }[] = [
  { id: "all", label: "All", sub: "every tablet" },
  { id: "OS", label: "Old script", sub: "c. 1650–1500 BCE" },
  { id: "MS", label: "Middle script", sub: "c. 1450–1350" },
  { id: "NS", label: "New script", sub: "c. 1350–1180" },
  { id: "LNS", label: "Late New", sub: "late 13th c." },
];
const PERS: Per[] = ["OS", "MS", "NS", "LNS"];
const CONF_LABEL: Record<Conf, string> = {
  site: "identified site",
  proposed: "proposed location, debated",
  region: "approximate area",
  river: "river",
  offmap: "beyond the map",
};
const KIND_LABEL = { city: "City", land: "Land", river: "River", mountain: "Mountain" } as const;

function countOf(p: Place, scope: "all" | "slice", per: "all" | Per) {
  const src = scope === "all" ? p.per : p.sl;
  if (per === "all") return Object.values(src).reduce((a, b) => a + (b || 0), 0);
  return src[per] || 0;
}

function useWidth(el: HTMLElement | null) {
  const [w, set] = useState(800);
  useEffect(() => {
    if (!el) return;
    set(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

interface View { x: number; y: number; k: number }

export default function MapPage() {
  const { data: M } = useData<MapData>("map.json");
  const { data: idx } = useIndex();
  const [sp, setSp] = useSearchParams();
  const scope = (sp.get("scope") === "slice" ? "slice" : "all") as "all" | "slice";
  const per = (STOPS.find((s) => s.id === sp.get("per"))?.id ?? "all") as "all" | Per;
  const selId = sp.get("p");
  const [showEdges, setShowEdges] = useState(true);
  const [showOrigins, setShowOrigins] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<{ p: Place; x: number; y: number } | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pts: Map<number, [number, number]>; v: View; d0?: number; moved: boolean } | null>(null);
  const cw = useWidth(boxEl);

  const set = (k: string, v: string | null) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === null) n.delete(k);
        else n.set(k, v);
        return n;
      },
      { replace: true },
    );

  // lemma links from the reader: /map?l=<lemma>
  useEffect(() => {
    const l = sp.get("l");
    if (!M || !l) return;
    const p = M.places.find((x) => x.lem.includes(l) || x.key === l || x.name === l);
    const n = new URLSearchParams(sp);
    n.delete("l");
    if (p) n.set("p", p.id);
    setSp(n, { replace: true });
  }, [M, sp, setSp]);

  useEffect(() => {
    if (!playing) return;
    const order: ("all" | Per)[] = ["OS", "MS", "NS", "LNS"];
    let i = Math.max(0, order.indexOf(per));
    if (per === "all" || per === "LNS") {
      i = 0;
      set("per", "OS");
    }
    const t = setInterval(() => {
      i += 1;
      if (i >= order.length) {
        setPlaying(false);
        return;
      }
      set("per", order[i]);
    }, 1700);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const sliceDocs = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of idx?.docs || []) c[d.period || "?"] = (c[d.period || "?"] || 0) + 1;
    return c;
  }, [idx]);

  const denom = (p: "all" | Per) =>
    scope === "all"
      ? p === "all" ? M?.ndocs || 1 : M?.periodDocs[p] || 1
      : p === "all" ? idx?.docs.length || 1 : sliceDocs[p] || 1;

  const byId = useMemo(() => new Map((M?.places || []).map((p) => [p.id, p])), [M]);
  const sel = selId ? byId.get(selId) || null : null;

  if (!M || !idx) return <div className="wrap loading">Loading…</div>;

  const W = M.w, H = M.h;
  const s = cw / W; // screen px per map unit at k = 1
  const u = (px: number) => px / (s * view.k); // screen px → map units at current zoom
  const D = denom(per);
  const placed = M.places.filter((p) => p.x !== undefined);
  const shareOf = (p: Place) => countOf(p, scope, per) / D;
  const sz = Math.max(0.55, Math.min(1, cw / 900)); // smaller symbols on small screens
  const rOf = (sh: number) => (sh <= 0 ? 0 : Math.max(2.4, Math.min(34 * sz, 30 * sz * Math.sqrt(sh / 0.05))));
  const visible = placed.filter((p) => countOf(p, scope, per) > 0).sort((a, b) => shareOf(b) - shareOf(a));
  const vis = new Set(visible.map((p) => p.id));

  // co-mention lines for the chosen period
  const edgeCount = (e: Edge) => (per === "all" ? e.t : e.per[per] || 0);
  const edges = scope === "all" && showEdges
    ? M.edges.filter((e) => edgeCount(e) >= (per === "OS" || per === "MS" ? 1 : 2) && vis.has(e.a) && vis.has(e.b))
        .sort((a, b) => edgeCount(b) - edgeCount(a)).slice(0, 50)
    : [];
  const maxE = Math.max(1, ...edges.map(edgeCount));

  // labels with simple collision avoidance in screen space
  const labels: { p: Place; x: number; y: number; anchor: "start" | "middle"; region: boolean }[] = [];
  const boxes: [number, number, number, number][] = [];
  const toScreen = (x: number, y: number) => [(x - view.x) * s * view.k, (y - view.y) * s * view.k];
  const maxLabels = cw < 600 ? 14 : 42;
  const labelCands = [...visible, ...(sel && !vis.has(sel.id) && sel.x !== undefined ? [sel] : [])];
  for (const p of labelCands) {
    if (labels.length >= maxLabels && p !== sel) continue;
    const region = p.conf === "region";
    const offmap = p.conf === "offmap";
    const r = rOf(shareOf(p));
    const [sx, sy] = toScreen(p.x!, p.y!);
    const name = offmap ? p.name : p.name.replace(/ \(.*\)$/, "");
    const wpx = name.length * (region ? 9.4 : 7.6) + 8;
    const bx = region || offmap ? [sx - wpx / 2, sy - 7, sx + wpx / 2, sy + 7] : [sx + r + 3, sy - 8, sx + r + 3 + wpx, sy + 6];
    if (bx[2] < 0 || bx[0] > cw || bx[3] < 0 || bx[1] > H * s) continue;
    const clash = boxes.some((b) => !(bx[2] < b[0] || bx[0] > b[2] || bx[3] < b[1] || bx[1] > b[3]));
    if (clash && p !== sel) continue;
    boxes.push(bx as [number, number, number, number]);
    labels.push({ p, x: region || offmap ? p.x! : p.x! + u(r + 3), y: p.y!, anchor: region || offmap ? "middle" : "start", region });
  }

  // origins of the rituals in the collection, aggregated by homeland
  const hatt = byId.get("hattusa")!;
  const originGroups = new Map<string, Origin[]>();
  for (const o of M.origins) originGroups.set(o.from, [...(originGroups.get(o.from) || []), o]);

  // origin labels: centred under each homeland, nudged down until they stop overlapping
  const originLabel = new Map<string, { x: number; y: number; t: string }>();
  {
    const placedBoxes: [number, number, number, number][] = [];
    for (const [from, os] of originGroups) {
      const o = byId.get(from);
      if (!o || o.x === undefined || o.conf === "offmap") continue;
      const n = os.reduce((a, b) => a + b.n, 0);
      const t = `${os.length > 1 ? `${os.length} rituals` : os[0].who.split(",")[0]} · ${n} MS${n === 1 ? "" : "S"}`;
      const w = u(t.length * 6.8), h = u(13);
      let y = o.y! + u(rOf(shareOf(o)) + 14);
      for (let i = 0; i < 6; i++) {
        const b: [number, number, number, number] = [o.x! - w / 2, y - h, o.x! + w / 2, y];
        if (!placedBoxes.some((q) => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) {
          placedBoxes.push(b);
          break;
        }
        y += h;
      }
      originLabel.set(from, { x: o.x!, y, t });
    }
  }

  // zoom and pan
  const clampView = (v: View): View => {
    const k = Math.max(1, Math.min(10, v.k));
    return { k, x: Math.max(0, Math.min(W - W / k, v.x)), y: Math.max(0, Math.min(H - H / k, v.y)) };
  };
  const zoomAt = (mx: number, my: number, f: number) =>
    setView((v) => {
      const k = Math.max(1, Math.min(10, v.k * f));
      const px = v.x + mx / (s * v.k), py = v.y + my / (s * v.k);
      return clampView({ k, x: px - mx / (s * k), y: py - my / (s * k) });
    });
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && view.k === 1 && e.deltaY > 0) return;
    const r = svgRef.current!.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0022));
  };
  const onDown = (e: React.PointerEvent) => {
    if (!drag.current) drag.current = { pts: new Map(), v: view, moved: false };
    drag.current.pts.set(e.pointerId, [e.clientX, e.clientY]);
    drag.current.v = view;
    if (drag.current.pts.size === 2) {
      const [a, b] = [...drag.current.pts.values()];
      drag.current.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !d.pts.has(e.pointerId)) return;
    const prev = d.pts.get(e.pointerId)!;
    d.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (d.pts.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
      if (d.moved) {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        setView((v) => clampView({ ...v, x: v.x - dx / (s * v.k), y: v.y - dy / (s * v.k) }));
      }
    } else if (d.pts.size === 2 && d.d0) {
      const [a, b] = [...d.pts.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = svgRef.current!.getBoundingClientRect();
      d.moved = true;
      zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, dist / d.d0);
      d.d0 = dist;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.pts.delete(e.pointerId);
    if (d.pts.size === 0) setTimeout(() => (drag.current = null), 0);
  };
  const click = (p: Place) => {
    if (drag.current?.moved) return;
    set("p", sel?.id === p.id ? null : p.id);
  };

  const unplaced = M.places.filter((p) => p.x === undefined);
  const f = filter.trim().toLowerCase();
  const unplacedShown = unplaced.filter((p) => !f || p.name.toLowerCase().includes(f) || p.lem.some((l) => l.includes(f)));
  const neighbours = sel
    ? M.edges.filter((e) => e.a === sel.id || e.b === sel.id).map((e) => ({ p: byId.get(e.a === sel.id ? e.b : e.a)!, t: e.t })).slice(0, 10)
    : [];
  const top = visible.slice(0, 10);
  const stop = STOPS.find((x) => x.id === per)!;

  return (
    <div className="wrap wide page mapPage">
      <header className="pagehead">
        <h1>Map</h1>
        <p className="lede">
          Every place written with a city, land, river or mountain sign in TLHdig — {M.ndocs.toLocaleString()} tablets and fragments — counted
          by tablet and by the date of the handwriting. Circles show the share of that period’s tablets naming a place; lines join places named within
          {" "}{M.window + 1} lines of each other.
        </p>
      </header>

      <div className="mapbar">
        <div className="seg" role="group" aria-label="Which tablets">
          <button aria-pressed={scope === "all"} onClick={() => set("scope", null)}>All of TLHdig</button>
          <button aria-pressed={scope === "slice"} onClick={() => set("scope", "slice")}>Plague &amp; healing texts</button>
        </div>
        <div className="timeline" role="group" aria-label="Script period">
          <button className="iconbtn play" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play through the periods"} title={playing ? "Pause" : "Play through the periods"}>
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10" /><rect x="8" y="2" width="3" height="10" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5z" /></svg>
            )}
          </button>
          <div className="stops">
            <input
              type="range" min={0} max={STOPS.length - 1} step={1} value={STOPS.findIndex((x) => x.id === per)}
              onChange={(e) => { setPlaying(false); set("per", e.target.value === "0" ? null : STOPS[+e.target.value].id); }}
              aria-label="Script period" aria-valuetext={`${stop.label}, ${stop.sub}`}
            />
            <div className="ticks">
              {STOPS.map((x) => (
                <button key={x.id} className={x.id === per ? "on" : ""} onClick={() => { setPlaying(false); set("per", x.id === "all" ? null : x.id); }}>
                  <b>{x.label}</b><span>{x.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mapToggles">
          <label className="toggle"><input type="checkbox" checked={showEdges} disabled={scope === "slice"} onChange={(e) => setShowEdges(e.target.checked)} /> Connections</label>
          <label className="toggle"><input type="checkbox" checked={showOrigins} onChange={(e) => setShowOrigins(e.target.checked)} /> Where the healers came from</label>
        </div>
      </div>

      <div className="mapgrid">
        <div className="mapbox" ref={setBoxEl}>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${W / view.k} ${H / view.k}`}
            className="map"
            role="img"
            aria-label={`Map of places named in ${stop.label === "All" ? "all" : stop.label} tablets`}
            onWheel={onWheel}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" className="arrowhead" />
              </marker>
            </defs>
            <rect x={0} y={0} width={W} height={H} className="sea" />
            <path d={M.land} className="land" />
            <path d={M.lakes} className="lake" />
            <path d={M.rivers} className="river" />

            <g className="edges">
              {edges.map((e) => {
                const a = byId.get(e.a)!, b = byId.get(e.b)!;
                const on = sel && (e.a === sel.id || e.b === sel.id);
                return (
                  <line key={e.a + e.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    className={on ? "on" : sel ? "off" : ""}
                    style={{ strokeWidth: 0.6 + 2.6 * Math.sqrt(edgeCount(e) / maxE) }} />
                );
              })}
            </g>

            {showOrigins && (
              <g className="origins">
                {[...originGroups.entries()].map(([from, os]) => {
                  const o = byId.get(from);
                  if (!o || o.x === undefined) return null;
                  const n = os.reduce((a, b) => a + b.n, 0);
                  const mx = (o.x + hatt.x!) / 2, my = (o.y! + hatt.y!) / 2;
                  const dx = hatt.x! - o.x, dy = hatt.y! - o.y!;
                  const cx = mx - dy * 0.25, cy = my + dx * 0.25;
                  // stop short of Ḫattuša's circle so the arrowhead stays visible
                  const back = u(rOf(shareOf(hatt)) + 6);
                  const tx = hatt.x! - cx, ty = hatt.y! - cy, tl = Math.hypot(tx, ty) || 1;
                  const ex = hatt.x! - (tx / tl) * back, ey = hatt.y! - (ty / tl) * back;
                  return (
                    <g key={from}>
                      <path d={`M${o.x} ${o.y} Q${cx} ${cy} ${ex} ${ey}`} markerEnd="url(#arrow)"
                        style={{ strokeWidth: 1.2 + Math.sqrt(n) * 0.55 }} vectorEffect="non-scaling-stroke" />
                      {o.conf !== "offmap" && originLabel.get(from) && (
                        <text x={originLabel.get(from)!.x} y={originLabel.get(from)!.y} textAnchor="middle" className="orl" style={{ fontSize: u(11) }}>
                          {originLabel.get(from)!.t}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            <g className="dots">
              {placed.filter((p) => !vis.has(p.id) && p.conf !== "offmap").map((p) => (
                <circle key={p.id} cx={p.x} cy={p.y} r={u(1.6)} className="ghost" />
              ))}
              {[...visible].reverse().map((p) => {
                const r = u(rOf(shareOf(p)));
                const on = sel?.id === p.id;
                if (p.conf === "offmap") {
                  const a = ((p.edge || 0) * Math.PI) / 180;
                  const L = u(14);
                  return (
                    <g key={p.id} className={`off ${on ? "sel" : ""}`} onClick={() => click(p)}
                      onPointerMove={(e) => setHover({ p, x: e.clientX, y: e.clientY })} onPointerLeave={() => setHover(null)}>
                      <line x1={p.x! - Math.cos(a) * L} y1={p.y! - Math.sin(a) * L} x2={p.x! + Math.cos(a) * u(4)} y2={p.y! + Math.sin(a) * u(4)}
                        markerEnd="url(#arrow)" vectorEffect="non-scaling-stroke" />
                      <circle cx={p.x} cy={p.y} r={u(16)} className="hit" />
                    </g>
                  );
                }
                return (
                  <g key={p.id} className={`pt c-${p.conf} ${on ? "sel" : ""} ${sel && !on ? "dim" : ""} ${rOf(shareOf(p)) < 7 ? "small" : ""}`} onClick={() => click(p)}
                    onPointerMove={(e) => setHover({ p, x: e.clientX, y: e.clientY })} onPointerLeave={() => setHover(null)}>
                    <circle cx={p.x} cy={p.y} r={r} vectorEffect="non-scaling-stroke" />
                    <circle cx={p.x} cy={p.y} r={Math.max(r, u(9))} className="hit" />
                  </g>
                );
              })}
            </g>

            <g className="labels" aria-hidden>
              {labels.map(({ p, x, y, anchor, region }) => (
                <text key={p.id} x={x} y={p.conf === "offmap" ? y + u(p.y! > H / 2 ? -14 : 20) : region ? y + u(4) : y + u(4)} textAnchor={anchor}
                  className={`${region ? "rg" : ""} ${p.conf === "river" ? "rv" : ""} ${sel?.id === p.id ? "sel" : ""}`}
                  style={{ fontSize: u(region ? 10.5 : 12.5) }}>
                  {region ? p.name.toUpperCase() : p.name.replace(/ \(.*\)$/, "")}
                </text>
              ))}
            </g>
          </svg>
          <div className="zoom">
            <button className="iconbtn" onClick={() => zoomAt((cw || 1) / 2, (H * s) / 2, 1.6)} aria-label="Zoom in">+</button>
            <button className="iconbtn" onClick={() => zoomAt((cw || 1) / 2, (H * s) / 2, 1 / 1.6)} aria-label="Zoom out">−</button>
            {view.k > 1 && <button className="iconbtn" onClick={() => setView({ x: 0, y: 0, k: 1 })} aria-label="Reset view" style={{ fontSize: 11 }}>1×</button>}
          </div>
          <div className="mapkey">
            <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" className="k-site" /></svg> identified site</span>
            <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" className="k-proposed" /></svg> proposed</span>
            <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" className="k-region" /></svg> area only</span>
            <span className="sizes">
              {[0.005, 0.02, 0.05].map((v) => (
                <span key={v}><svg width={2 * rOf(v) + 2} height={2 * rOf(v) + 2}><circle cx={rOf(v) + 1} cy={rOf(v) + 1} r={rOf(v)} className="k-size" /></svg>{v * 100}%</span>
              ))}
              <span className="faint">of tablets</span>
            </span>
          </div>
        </div>

        <aside className="mapside" aria-live="polite">
          {sel ? (
            <PlacePanel p={sel} scope={scope} M={M} neighbours={neighbours} onPick={(id) => set("p", id)} onClose={() => set("p", null)} sliceDocs={sliceDocs} />
          ) : (
            <div>
              <p className="label">{stop.label === "All" ? "All periods" : `${stop.label} · ${stop.sub}`}</p>
              <p className="muted" style={{ fontSize: 14, margin: "6px 0 14px" }}>
                {D.toLocaleString()} {scope === "all" ? "tablets in TLHdig" : "manuscripts in the plague & healing collection"}
                {per !== "all" && " written in this hand"}. Most often named:
              </p>
              <ol className="toplist">
                {top.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => set("p", p.id)}>
                      <span>{p.name}</span>
                      <span className="mono faint">{(shareOf(p) * 100).toFixed(shareOf(p) < 0.01 ? 1 : 0)}%</span>
                    </button>
                  </li>
                ))}
              </ol>
              {showOrigins && (
                <div style={{ marginTop: 20 }}>
                  <p className="label">Where the healers came from</p>
                  <ul className="origlist">
                    {M.origins.map((o) => (
                      <li key={o.cth}><Link className="link" to={`/cth/${o.cth}`}>{o.who}</Link> <span className="faint">· {byId.get(o.from)?.name} · {o.n} MS{o.n === 1 ? "" : "S"}</span></li>
                    ))}
                  </ul>
                  <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>
                    Homelands as the texts themselves state them (“man of Arzawa”, “physician of Kizzuwatna”). Arrows run to Ḫattuša, where the tablets were found.
                  </p>
                </div>
              )}
              <p className="faint" style={{ fontSize: 12.5, marginTop: 20, lineHeight: 1.55 }}>
                Script dates are of the handwriting, not of the text: many New-script tablets copy older compositions, so the slider shows what scribes of
                each period were writing down. {M.periodDocs["?"].toLocaleString()} fragments have no script date and appear only under “All”.
              </p>
            </div>
          )}
        </aside>
      </div>

      <section className="unplaced">
        <div className="gh" style={{ marginTop: 44 }}>
          <h2>Not on the map</h2>
          <p>{unplaced.length} places named on two or more tablets have no agreed location — most of the Hittite world. Counts are tablets.</p>
        </div>
        <input className="field" placeholder="Filter places…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 320, marginBottom: 10 }} />
        <div className="uplist">
          <div className="uph"><span>Place</span><span className="r">Tablets</span>{PERS.map((x) => <span key={x} className="r">{x}</span>)}</div>
          {(showAll || f ? unplacedShown : unplacedShown.slice(0, 60)).map((p) => (
            <button key={p.id} className={`uprow ${sel?.id === p.id ? "on" : ""}`} onClick={() => { set("p", p.id); boxEl?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <span className="nm">{p.name}<span className="faint"> {p.kind !== "city" ? KIND_LABEL[p.kind].toLowerCase() : ""}</span></span>
              <span className="r mono">{p.t}</span>
              {PERS.map((x) => {
                const v = p.per[x] || 0;
                const sh = v / (M.periodDocs[x] || 1);
                return <span key={x} className="r mono cell" style={{ background: v ? `color-mix(in srgb, var(--accent) ${Math.min(70, 8 + sh * 4000)}%, transparent)` : undefined }}>{v || ""}</span>;
              })}
            </button>
          ))}
        </div>
        {!showAll && !f && unplacedShown.length > 60 && (
          <button className="chip" style={{ marginTop: 12 }} onClick={() => setShowAll(true)}>Show all {unplacedShown.length}</button>
        )}
      </section>

      {hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 14, window.innerWidth - 300), top: hover.y + 14 }} role="tooltip">
          <div className="h">{hover.p.name}</div>
          <div className="faint">{KIND_LABEL[hover.p.kind]}{hover.p.conf ? ` · ${CONF_LABEL[hover.p.conf]}` : ""}</div>
          <div className="mono" style={{ marginTop: 4 }}>
            {countOf(hover.p, scope, per)} of {D.toLocaleString()} tablets ({(shareOf(hover.p) * 100).toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  );
}

function PlacePanel({ p, scope, M, neighbours, onPick, onClose, sliceDocs }: {
  p: Place; scope: "all" | "slice"; M: MapData; neighbours: { p: Place; t: number }[];
  onPick: (id: string) => void; onClose: () => void; sliceDocs: Record<string, number>;
}) {
  const shares = PERS.map((x) => {
    const v = scope === "all" ? p.per[x] || 0 : p.sl[x] || 0;
    const d = scope === "all" ? M.periodDocs[x] : sliceDocs[x] || 0;
    return { x, v, sh: d ? v / d : 0 };
  });
  const maxSh = Math.max(0.0001, ...shares.map((s) => s.sh));
  return (
    <div className="placepanel">
      <button className="iconbtn close" onClick={onClose} aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.6"><path d="M2 2l10 10M12 2L2 12" /></svg>
      </button>
      <p className="label">{KIND_LABEL[p.kind]}{p.conf ? ` · ${CONF_LABEL[p.conf]}` : " · location unknown"}</p>
      <h2 className="pname">{p.name}</h2>
      {p.note && <p className="muted" style={{ fontSize: 14 }}>{p.note}{p.wd && <> <a className="link" href={`https://www.wikidata.org/wiki/${p.wd}`} target="_blank" rel="noreferrer">Wikidata ↗</a></>}</p>}
      {!p.conf && <p className="muted" style={{ fontSize: 14 }}>No agreed location. Written in TLHdig as <span className="tx-i">{p.lem.slice(0, 4).join(", ") || p.key}</span>.</p>}
      <p style={{ marginTop: 12, fontSize: 14 }}>
        Named on <b className="mono">{p.t}</b> tablet{p.t === 1 ? "" : "s"} in TLHdig ({p.n} mentions)
        {Object.values(p.sl).some(Boolean) && <>, <b className="mono">{Object.values(p.sl).reduce((a, b) => a + (b || 0), 0)}</b> in the plague &amp; healing texts</>}.
      </p>
      <div className="pershares" aria-label="Share of each period's tablets">
        {shares.map(({ x, v, sh }) => (
          <div key={x} className="ps">
            <span className="mono faint">{x}</span>
            <span className="bar"><i style={{ width: `${(sh / maxSh) * 100}%` }} /></span>
            <span className="mono">{v ? `${v} · ${(sh * 100).toFixed(sh < 0.01 ? 2 : 1)}%` : "—"}</span>
          </div>
        ))}
        <p className="faint" style={{ fontSize: 12 }}>Share of each period’s {scope === "all" ? "tablets" : "manuscripts in the collection"}; {p.per["?"] || 0} undated.</p>
      </div>
      {neighbours.length > 0 && (
        <>
          <p className="label" style={{ marginTop: 18 }}>Named alongside</p>
          <div className="chips">
            {neighbours.map(({ p: q, t }) => (
              <button key={q.id} className="chip" onClick={() => onPick(q.id)}>{q.name} <span className="n">{t}</span></button>
            ))}
          </div>
        </>
      )}
      {p.att && p.att.length > 0 && (
        <>
          <p className="label" style={{ marginTop: 18 }}>In the plague &amp; healing texts</p>
          <div className="mapkwic"><Kwic rows={p.att.slice(0, 12)} /></div>
        </>
      )}
      <p className="label" style={{ marginTop: 18 }}>Tablets naming it most often</p>
      <ul className="doclist">
        {p.docs.map(([docid, cth, per, k]) => (
          <li key={docid}>
            <a href={`https://hethport.net/TLHdig/tlh_xtx.php?d=${encodeURIComponent(docid)}`} target="_blank" rel="noreferrer">{docid}</a>
            <span className="faint mono">{cth ? `CTH ${cth}` : ""}{per !== "?" ? ` · ${per}` : ""} · ×{k}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
