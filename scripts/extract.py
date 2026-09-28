"""Stage 1: extract the slice from TLHdig AOxml into a rich intermediate JSON.

Keeps, per word: every character with its damage state (ok / broken / half-broken / erased)
and kind (syllabic / Sumerogram / Akkadogram / determinative / number), the separators,
all morphological analyses (lemma, German gloss, morphology, stem class, determinatives)
and the editor's selected analysis. Keeps paragraph rulings and per-line language + cuneiform.

Input:  ../hittite-tlhdig/data/raw/...  (TLHdig Beta 0.3, CC BY 4.0)
Output: build/extract.json
"""
import html
import json
import os
import re
import sys

from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..", "hittite-tlhdig", "data", "raw", "TLHbasisONLINE25_1_ZENODO_Beta_03")
OUT = os.path.join(HERE, "..", "build", "extract.json")

SLICE = {
    # group -> CTH numbers
    "medicine": ["460", "461", "783"],
    "akkadian-medicine": ["802", "808", "809", "811"],
    "plague-ritual": ["394", "407", "410", "424", "425", "426", "757"],
    "plague-prayer": ["378"],
    "healing-ritual": ["402", "406", "409"],
}
CTH2GROUP = {c: g for g, cs in SLICE.items() for c in cs}

KIND = {"d": "det", "sGr": "sum", "aGr": "akk", "num": "num"}
SKIP = {"note", "annot", "corr", "space", "gap"}


def local(el):
    return etree.QName(el).localname if isinstance(el.tag, str) else None


class St:
    def __init__(self):
        self.broken = False
        self.half = False
        self.erased = False

    def code(self):
        # b = broken (restored), h = half-broken, e = erased, o = ok
        if self.broken:
            return "b"
        if self.half:
            return "h"
        if self.erased:
            return "e"
        return "o"


def walk(el, st, out, kind):
    name = local(el)
    k = kind
    if name == "del_in":
        st.broken = True
    elif name == "del_fin":
        st.broken = False
    elif name == "laes_in":
        st.half = True
    elif name == "laes_fin":
        st.half = False
    elif name == "ras_in":
        st.erased = True
    elif name == "ras_fin":
        st.erased = False
    elif name in KIND:
        k = KIND[name]
    elif name == "corr":
        c = el.get("c", "")
        if c:
            out.append([c, "o", "corr"])
    if name not in SKIP:
        if el.text:
            for ch in el.text:
                out.append([ch, st.code(), k])
        for c in el:
            walk(c, st, out, k)
    if el.tail and name is not None:
        for ch in el.tail:
            out.append([ch, st.code(), kind])


def compress(chars):
    """Merge consecutive chars with equal (state, kind) into runs [text, state, kind]."""
    runs = []
    for ch, s, k in chars:
        if runs and runs[-1][1] == s and runs[-1][2] == k:
            runs[-1][0] += ch
        else:
            runs.append([ch, s, k])
    return runs


def parse_mrp(v):
    parts = html.unescape(v).split("@")
    parts = [p.strip() for p in parts]
    lem = re.sub(r"^[①②③④⑤⑥⑦⑧⑨Ⓐ-Ⓩ\s]+", "", parts[0]) if parts else ""
    return {
        "lemma": lem,
        "gloss": parts[1] if len(parts) > 1 else "",
        "morph": parts[2] if len(parts) > 2 else "",
        "stem": parts[3] if len(parts) > 3 else "",
        "det": parts[4] if len(parts) > 4 else "",
    }


def first_marker(lb):
    for el in lb.itersiblings():
        if local(el) == "lb":
            return None
        for sub in el.iter():
            n = local(sub)
            if n == "del_in":
                return "in"
            if n == "del_fin":
                return "fin"
    return None


def parse_doc(path):
    tree = etree.parse(path, etree.XMLParser(recover=True, huge_tree=True))
    r = tree.getroot()
    docid, pubs = None, []
    for el in r.iter():
        n = local(el)
        if n == "docID" and docid is None:
            docid = (el.text or "").strip()
        if n in ("TxtPubl", "mDocID"):
            t = "".join(el.itertext()).strip()
            if t and t not in pubs:
                pubs.append(t)
    texts = [el for el in r.iter() if local(el) == "text"]
    lines, cur = [], None
    st = St()

    def trav(node):
        for c in node:
            if not isinstance(c.tag, str):
                continue
            yield c
            if local(c) not in ("w", "note", "Manuscripts"):
                yield from trav(c)

    for text in texts:
        for el in trav(text):
            n = local(el)
            if n == "lb":
                fm = first_marker(el)
                if fm == "fin":
                    st.broken = True
                elif fm == "in":
                    st.broken = False
                cur = {"n": (el.get("lnr") or "").strip(), "lg": el.get("lg") or "", "cu": el.get("cu") or "",
                       "t": [], "rule": 0, "startBroken": st.broken}
                lines.append(cur)
            elif n == "w":
                if cur is None:
                    cur = {"n": "", "lg": "", "cu": "", "t": [], "rule": 0, "startBroken": st.broken}
                    lines.append(cur)
                chars = []
                if el.text:
                    for ch in el.text:
                        chars.append([ch, st.code(), "syl"])
                for c in el:
                    walk(c, st, chars, "syl")
                runs = compress(chars)
                txt = "".join(r_[0] for r_ in runs).strip()
                if not txt:
                    continue
                alts = []
                for k in sorted((a for a in el.attrib if re.fullmatch(r"mrp\d+", a) and a != "mrp0sel"),
                                key=lambda a: int(a[3:])):
                    alts.append(parse_mrp(el.get(k)))
                sel = (el.get("mrp0sel") or "").strip()
                cur["t"].append({"r": runs, "tr": el.get("trans") or "", "a": alts, "sel": sel})
            elif n in ("del_in", "del_fin"):
                st.broken = n == "del_in"
            elif n in ("parsep", "parsep_dbl"):
                if cur is not None:
                    cur["rule"] = 2 if n == "parsep_dbl" else 1
            elif n == "gap":
                if cur is not None:
                    cur["t"].append({"gap": el.get("c", "")})
    return {"docid": docid, "pubs": pubs, "lines": lines}


def main():
    docs, seen = [], set()
    for d in sorted(os.listdir(ROOT)):
        m = re.match(r"CTH (\d+)_XML_(\w+)", d)
        if not m or m.group(1) not in CTH2GROUP:
            continue
        cth = m.group(1)
        for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
            for f in sorted(fn):
                if not f.endswith(".xml"):
                    continue
                p = os.path.join(dp, f)
                try:
                    doc = parse_doc(p)
                except Exception as e:  # noqa
                    print("FAIL", p, e, file=sys.stderr)
                    continue
                key = (doc["docid"], cth)
                if key in seen:
                    continue
                seen.add(key)
                doc["cth"] = cth
                doc["group"] = CTH2GROUP[cth]
                doc["project"] = m.group(2)
                doc["path"] = os.path.relpath(p, ROOT)
                docs.append(doc)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"slice": SLICE, "docs": docs}, open(OUT, "w"), ensure_ascii=False)
    nw = sum(1 for d in docs for L in d["lines"] for t in L["t"] if "r" in t)
    print(len(docs), "docs;", sum(len(d["lines"]) for d in docs), "lines;", nw, "words")


if __name__ == "__main__":
    main()
