import type { SubCls } from "../lib/data";

/** Shape + colour mark for a substance class. Shape carries identity too (never colour alone). */
export function ClassMark({ cls, size = 10, faded = false, title }: { cls: SubCls; size?: number; faded?: boolean; title?: string }) {
  const c = `var(--${cls})`;
  const s = size;
  const h = s / 2;
  let shape;
  switch (cls) {
    case "plant":
      shape = <circle cx={h} cy={h} r={h - 0.5} fill={c} />;
      break;
    case "mineral":
      shape = <path d={`M${h} 0 L${s} ${h} L${h} ${s} L0 ${h} Z`} fill={c} />;
      break;
    case "animal":
      shape = <path d={`M${h} 0.3 L${s - 0.3} ${s - 0.5} L0.3 ${s - 0.5} Z`} fill={c} />;
      break;
    case "food":
      shape = <rect x={0.8} y={0.8} width={s - 1.6} height={s - 1.6} rx={1} fill={c} />;
      break;
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}
      style={{ opacity: faded ? 0.18 : 1, flex: "none" }}>
      {title && <title>{title}</title>}
      {shape}
    </svg>
  );
}

export function PeriodDots({ periods }: { periods: Record<string, number> }) {
  const order = ["OS", "MS", "NS", "LNS"];
  const max = Math.max(1, ...order.map((p) => periods[p] || 0));
  return (
    <span className="periods" title={order.map((p) => `${p}: ${periods[p] || 0}`).join(" · ") + (periods["?"] ? ` · undated: ${periods["?"]}` : "")}>
      {order.map((p) => (
        <span className="pd" key={p}>
          <b style={{ height: `${periods[p] ? Math.max(2, Math.round((periods[p] / max) * 16)) : 1}px`, opacity: periods[p] ? 1 : 0.2 }} />
          <i>{p === "LNS" ? "LN" : p}</i>
        </span>
      ))}
    </span>
  );
}

export function PresBar({ v }: { v: number }) {
  return (
    <span className="presbar" title={`${Math.round(v * 100)}% of signs preserved`}>
      <i style={{ width: `${Math.round(v * 100)}%` }} />
    </span>
  );
}
