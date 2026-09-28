"""Print a translation worksheet for one manuscript: paragraph by paragraph (following the scribe's rulings),
each line's transliteration (brackets for restorations) plus compact per-word glosses.

usage: python scripts/worksheet.py <doc-slug> [out.txt]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "public", "data", "docs")


def plain(w):
    if "gap" in w:
        return "<" + w["gap"] + ">"
    out, prev = "", "o"
    for t, st, k in w["r"]:
        if k == "det":
            t = {"D": "d", "m": "m", "M": "m", "f": "f"}.get(t, t)
            t = "^" + t + "^"
        if st == "b" and prev != "b":
            out += "["
        if st != "b" and prev == "b":
            out += "]"
        out += t
        prev = st
    if prev == "b":
        out += "]"
    return out


def main():
    slug = sys.argv[1]
    D = json.load(open(os.path.join(DATA, slug + ".json")))
    lines = D["lines"]
    out = [f"# {D['docid']} (CTH {D['cth']}; pieces: {' + '.join(D['pubs'])})", ""]
    for pi, (a, b, rule) in enumerate(D["paras"]):
        out.append(f"== §{pi}  lines {a}-{b}  ({lines[a]['n'].strip()} – {lines[b]['n'].strip()})")
        for li in range(a, b + 1):
            L = lines[li]
            tl = " ".join(plain(w) for w in L["w"])
            gl = "; ".join(f"{w.get('l','?')}={w.get('g','')}" for w in L["w"] if "r" in w and w.get("g"))
            lg = f" [{L['lg']}]" if L["lg"] and L["lg"] != "Hit" else ""
            out.append(f"  {li:>3} {L['n'].strip():<16}{lg} {tl}")
            if gl:
                out.append(f"      · {gl}")
        out.append("")
    txt = "\n".join(out)
    if len(sys.argv) > 2:
        open(sys.argv[2], "w").write(txt)
    else:
        print(txt)


if __name__ == "__main__":
    main()
