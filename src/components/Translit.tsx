import { Fragment, type ReactNode } from "react";
import { gapLabel, isGap, type Run, type State, type Token, type Word } from "../lib/data";

const DET: Record<string, string> = { D: "d", m: "m", M: "m", f: "f", F: "f", "m.D": "m.d", "M.D": "m.d" };

function runText(r: Run): string {
  if (r[2] === "det") return DET[r[0]] ?? r[0];
  return r[0].replace(/[\u2329\u3008]/g, "⟨").replace(/[\u232A\u3009]/g, "⟩").replace(/Zeichen/g, "signs");
}

export interface TranslitOpts {
  brackets: boolean;
  glosses: boolean;
  highlight: boolean;
  focusSubstance?: string | null;
}

/** Renders a line of tokens. Bracket state is tracked across words, so a break
 * that spans several words gets one [ … ] pair, exactly as in a printed edition. */
export function TranslitLine({
  tokens,
  opts,
  selected,
  onSelect,
}: {
  tokens: Token[];
  opts: TranslitOpts;
  selected?: number | null;
  onSelect?: (wi: number) => void;
}) {
  const cur: { prev: State } = { prev: "o" };
  const out: ReactNode[] = [];

  const open = (s: State) => (s === "b" ? "[" : s === "h" ? "⸢" : "");
  const close = (s: State) => (s === "b" ? "]" : s === "h" ? "⸣" : "");

  tokens.forEach((t, wi) => {
    if (isGap(t)) {
      if (opts.brackets && cur.prev !== "o" && cur.prev !== "e") out.push(<span key={`c${wi}`} className="br">{close(cur.prev)}</span>);
      cur.prev = "o";
      if (t.gap && t.gap !== "brk") out.push(<span key={`g${wi}`} className="gapn">{gapLabel(t.gap)}</span>);
      out.push(" ");
      return;
    }
    const w = t as Word;
    const parts: ReactNode[] = [];
    const nxt = tokens[wi + 1];
    const nextFirst: State = !nxt || isGap(nxt) ? "o" : ((nxt as Word).r.find((r) => r[2] !== "corr")?.[1] ?? "o");
    w.r.forEach((r, ri) => {
      const s: State = r[2] === "corr" ? cur.prev : r[1];
      if (opts.brackets && s !== cur.prev) {
        const c = close(cur.prev);
        const o = open(s);
        if (c || o) parts.push(<span key={`b${ri}`} className="br">{c}{o}</span>);
      }
      cur.prev = s;
      parts.push(
        <span key={ri} className={`s-${r[2]} st-${r[1]}`}>
          {runText(r)}
        </span>,
      );
    });
    if (opts.brackets && (cur.prev === "b" || cur.prev === "h") && nextFirst !== cur.prev) {
      parts.push(<span key="close" className="br">{close(cur.prev)}</span>);
      cur.prev = "o";
    }
    const faded = opts.focusSubstance ? w.s !== opts.focusSubstance : false;
    const cls = ["w", w.k ? `k-${w.k}` : "", selected === wi ? "sel" : "", faded ? "dim" : ""].filter(Boolean).join(" ");
    const inner = (
      <span
        className={cls}
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(wi)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(wi);
          }
        }}
        aria-label={w.g ? `${w.tr || ""} — ${w.g}` : undefined}
      >
        {parts}
      </span>
    );
    out.push(
      opts.glosses ? (
        <span className="wg" key={wi}>
          {inner}
          <span className="gl">{w.g || (w.lang ? w.lang : " ")}</span>
        </span>
      ) : (
        <Fragment key={wi}>
          {inner}{" "}
        </Fragment>
      ),
    );
  });
  if (opts.brackets && (cur.prev === "b" || cur.prev === "h")) out.push(<span key="end" className="br">{close(cur.prev)}</span>);
  return <>{out}</>;
}

/** Compact plain rendering for single words (inspector, KWIC). */
export function WordForm({ w }: { w: Word }) {
  return (
    <>
      {w.r.map((r, i) => (
        <span key={i} className={`s-${r[2]} st-${r[1]}`}>
          {runText(r)}
        </span>
      ))}
    </>
  );
}
