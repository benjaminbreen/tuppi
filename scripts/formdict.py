"""Build a written-form -> analysis dictionary from the WHOLE TLHdig corpus.

Only analyses that are editor-selected (mrp0sel numeric) or the sole analysis offered are counted.
Used to gloss words that TLHdig leaves unanalysed in some sub-projects (flagged in the UI as 'by form').
Output: build/formdict.json  {form: [lemma, gloss_de, morph, share, count]}
"""
import collections
import html
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..", "hittite-tlhdig", "data", "raw", "TLHbasisONLINE25_1_ZENODO_Beta_03")
OUT = os.path.join(HERE, "..", "build", "formdict.json")
W = re.compile(r"<w\b([^>]*)>(.*?)</w>", re.S)
A = re.compile(r'(mrp\d+(?:sel)?)="([^"]*)"')
SKIP_TAGS = re.compile(r"<(note|annot|corr|space|gap)\b[^>]*/>|<(note|annot)\b.*?</\2>", re.S)


def form_key(inner_text: str) -> str:
    s = re.sub(r"[\[\]⸢⸣?!°〈〉«»]", "", inner_text)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def main():
    cnt = collections.defaultdict(collections.Counter)
    for dp, dn, fn in os.walk(ROOT):
        if "__MACOSX" in dp:
            continue
        for f in fn:
            if not f.endswith(".xml"):
                continue
            s = open(os.path.join(dp, f), encoding="utf-8", errors="replace").read()
            for m in W.finditer(s):
                attrs = dict(A.findall(m.group(1)))
                alts = sorted((k for k in attrs if re.fullmatch(r"mrp\d+", k) and k != "mrp0"), key=lambda k: int(k[3:]))
                if not alts:
                    continue
                sel = (attrs.get("mrp0sel") or "").strip()
                mm = re.match(r"^(\d+)", sel)
                if mm:
                    k = f"mrp{mm.group(1)}"
                    if k not in attrs:
                        continue
                elif len(alts) == 1:
                    k = alts[0]
                else:
                    continue
                parts = [p.strip() for p in html.unescape(attrs[k]).split("@")]
                lemma = re.sub(r"^[①②③④⑤⑥⑦⑧⑨Ⓐ-Ⓩ\s]+", "", parts[0])
                gloss = parts[1] if len(parts) > 1 else ""
                morph = parts[2] if len(parts) > 2 else ""
                inner = SKIP_TAGS.sub("", m.group(2))
                inner = re.sub(r"<[^>]+>", "", inner)
                key = form_key(html.unescape(inner))
                if key:
                    cnt[key][(lemma, gloss, morph)] += 1
    out = {}
    for key, c in cnt.items():
        tot = sum(c.values())
        (lemma, gloss, morph), n = c.most_common(1)[0]
        # lemma-level agreement (morph may vary)
        lem_n = sum(v for (l, g, _), v in c.items() if l == lemma)
        share = lem_n / tot
        if share >= 0.6:
            out[key] = [lemma, gloss, morph if n / tot >= 0.6 else "", round(share, 2), tot]
    json.dump(out, open(OUT, "w"), ensure_ascii=False)
    print(len(out), "forms")


if __name__ == "__main__":
    main()
