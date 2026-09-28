"""Place-name index for the map: every place named (with a URU/KUR/ÍD/ḪUR.SAG determinative) anywhere in TLHdig,
counted by tablet and by script period, plus co-mentions and the origins of the healing rituals in the collection.

Reads the parsed corpus from ../hittite-tlhdig/data (see that project's parse_tlh.py) and the site's own docs.
Writes build/places.json, which scripts/map.mjs projects onto the basemap.
"""
import collections
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gazetteer import G, NOT_PLACES  # noqa: E402

SITE = os.path.join(HERE, "..")
RESEARCH = os.path.join(SITE, "..", "hittite-tlhdig", "data")
PLACE_DETS = {"URU", "KUR", "ÍD", "ḪUR.SAG"}
PERSON_DETS = {"LÚ", "MUNUS", "D", "m", "f", "M", "F"}
PERIODS = ["OS", "MS", "NS", "LNS", "?"]
Z = {"sjh.": "LNS", "jh.": "NS", "mh.": "MS", "ah.": "OS"}
WINDOW = 2  # co-mention: named within this many lines of each other

# rituals in the collection whose texts name the practitioner's homeland (from the incipits/colophons)
ORIGINS = [
    ("757", "Zarpiya, physician", "Kizuwatna"),
    ("410", "Uḫḫamuwa", "Arzawa"),
    ("394", "Ašḫella", "Ḫapalla"),
    ("425", "Madduwani & Dandanku, augurs", "Arzawa"),
    ("402", "Alli, Old Woman", "Arzawa"),
    ("406", "Paškuwatti", "Arzawa"),
    ("409", "Tunnawiya, Old Woman", "Unteres Land"),
    ("802", "Babylonian medicine (Akkadian)", "Babylon"),
    ("808", "Babylonian medicine (Akkadian)", "Babylon"),
    ("809", "Babylonian medicine (Akkadian)", "Babylon"),
    ("811", "Babylonian medicine (Akkadian)", "Babylon"),
]


def slug(s):
    s = s.lower()
    for a, b in (("ḫ", "h"), ("š", "s"), ("ṣ", "s"), ("ṭ", "t"), ("ā", "a"), ("ē", "e"), ("ī", "i"), ("ū", "u")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def canon_map():
    m = {}
    for key, (name, kind, conf, lat, lon, note, wd, extra) in G.items():
        for k in [key] + extra:
            m[k] = key
    return m


def load_periods():
    S_ = json.load(open(os.path.join(RESEARCH, "konk_sections.json")))
    by = {}
    for rows in S_.values():
        for r in rows:
            pub = re.sub(r"\s+", " ", r["publ"]).strip()
            if pub and pub != "." and pub not in by:
                z = (r.get("zeit") or "").strip()
                by[pub] = next((v for k, v in Z.items() if z.startswith(k)), "?")
    return by


def main():
    CM = canon_map()
    per_of = load_periods()
    mentions = collections.Counter()
    tablets = collections.defaultdict(lambda: collections.Counter())  # canon -> period -> n tablets
    docs_of = collections.defaultdict(list)  # canon -> [(n, docid, cth, period)]
    edges = collections.defaultdict(lambda: collections.Counter())  # (a,b) -> period -> n tablets
    kinds = collections.defaultdict(collections.Counter)
    lemma_gloss = collections.defaultdict(collections.Counter)
    period_docs = collections.Counter()
    ndocs = 0
    for line in open(os.path.join(RESEARCH, "parsed", "docs.jsonl")):
        d = json.loads(line)
        ndocs += 1
        per = per_of.get(d["publ"], "?")
        period_docs[per] += 1
        found = []  # (line index, canon)
        for li, L in enumerate(d["lines"]):
            for w in L["w"]:
                sg = w.get("sg")
                if not sg:
                    continue
                dets = [s["s"] for s in sg if s["k"] == "det"]
                pd = [x for x in dets if x in PLACE_DETS]
                if not pd or any(x in PERSON_DETS for x in dets):
                    continue
                lemma, gloss = (w.get("l") or "").strip(), (w.get("g") or "").strip()
                if not lemma or gloss in NOT_PLACES or re.search(r"(isch|ili)$", gloss):
                    continue
                gloss = gloss or lemma
                lemma_gloss[re.sub(r"^[①-⑳⓵-⓿ⓐ-ⓩⒶ-Ⓩ\s]+", "", lemma)][gloss] += 1
                c = CM.get(gloss, gloss)
                kinds[c][{"URU": "city", "KUR": "land", "ÍD": "river", "ḪUR.SAG": "mountain"}[pd[0]]] += 1
                found.append((li, c))
        if not found:
            continue
        cnt = collections.Counter(c for _, c in found)
        for c, n in cnt.items():
            mentions[c] += n
            tablets[c][per] += 1
            docs_of[c].append((n, d["docid"], d.get("cth") or "", per))
        pairs = set()
        for i, (la, a) in enumerate(found):
            for lb, b in found[i + 1:]:
                if lb - la > WINDOW:
                    break
                if a != b:
                    pairs.add(tuple(sorted((a, b))))
        for p in pairs:
            edges[p][per] += 1

    # the collection's own manuscripts: attestations with context, for click-through
    lemma_canon = {l: CM.get(g.most_common(1)[0][0], g.most_common(1)[0][0]) for l, g in lemma_gloss.items()}
    lemmas_of = collections.defaultdict(set)
    for l, c in lemma_canon.items():
        lemmas_of[c].add(l)
    idx = json.load(open(os.path.join(SITE, "public", "data", "index.json")))
    period_of_doc = {m["id"]: (m["period"] or "?") for m in idx["docs"]}

    def plain(w):
        if "gap" in w:
            return "…"
        return "".join(("[" + t + "]") if st == "b" else t for t, st, k in w["r"]).replace("][", "")

    att = collections.defaultdict(list)
    slice_tablets = collections.defaultdict(collections.Counter)
    for f in sorted(glob.glob(os.path.join(SITE, "public", "data", "docs", "*.json"))):
        D = json.load(open(f))
        seen = set()
        for li, L in enumerate(D["lines"]):
            for wi, w in enumerate(L["w"]):
                if w.get("k") != "place" or not w.get("l"):
                    continue
                lem = re.sub(r"^[①-⑳⓵-⓿ⓐ-ⓩⒶ-Ⓩ\s]+", "", w["l"])
                c = lemma_canon.get(lem)
                if c is None:
                    g = w.get("gd") or w.get("g") or ""
                    c = CM.get(g, g) if g and g not in NOT_PLACES else None
                if not c:
                    continue
                words = L["w"]
                att[c].append({"d": D["id"], "docid": D["docid"], "li": li, "wi": wi, "n": L["n"],
                               "left": " ".join(plain(x) for x in words[max(0, wi - 4):wi]), "kw": plain(w),
                               "right": " ".join(plain(x) for x in words[wi + 1:wi + 5])})
                seen.add(c)
        for c in seen:
            slice_tablets[c][period_of_doc.get(D["id"], "?")] += 1

    comp_docs = {c["cth"]: c["nDocs"] for c in idx["compositions"]}
    origins = [{"cth": cth, "who": who, "from": CM.get(k, k), "n": comp_docs.get(cth, 0)} for cth, who, k in ORIGINS if comp_docs.get(cth)]

    out = []
    for c, n in mentions.items():
        t = sum(tablets[c].values())
        if t < 2 and c not in G and c not in att:
            continue
        g = G.get(c)
        kind = g[1] if g else kinds[c].most_common(1)[0][0]
        docs = sorted(docs_of[c], key=lambda x: (-x[0], x[1]))
        rec = {
            "id": slug(g[0] if g else c), "key": c, "name": g[0] if g else c, "kind": kind,
            "conf": g[2] if g else None, "n": n, "t": t,
            "per": {p: tablets[c][p] for p in PERIODS if tablets[c][p]},
            "sl": {p: slice_tablets[c][p] for p in PERIODS if slice_tablets[c][p]},
            "docs": [[docid, cth, per, k] for k, docid, cth, per in docs[:14 if g else 6]],
        }
        if g:
            rec.update({"lat": g[3], "lon": g[4], "note": g[5], "wd": g[6]})
        if att.get(c):
            rec["att"] = att[c][:60]
        rec["lem"] = sorted(lemmas_of.get(c, []))[:12]
        out.append(rec)
    out.sort(key=lambda r: -r["t"])
    placed = {r["key"] for r in out if r["conf"]}
    E = []
    for (a, b), pc in edges.items():
        if a in placed and b in placed:
            tot = sum(pc.values())
            if tot >= 2:
                E.append({"a": slug(G[a][0]), "b": slug(G[b][0]), "t": tot, "per": {p: pc[p] for p in PERIODS if pc[p]}})
    E.sort(key=lambda e: -e["t"])
    for o in origins:
        o["from"] = slug(G[o["from"]][0]) if o["from"] in G else o["from"]
    res = {"places": out, "edges": E, "origins": origins, "periodDocs": {p: period_docs[p] for p in PERIODS},
           "ndocs": ndocs, "window": WINDOW}
    os.makedirs(os.path.join(SITE, "build"), exist_ok=True)
    json.dump(res, open(os.path.join(SITE, "build", "places.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{ndocs} tablets; {len(out)} places ({len(placed)} placed, {sum(1 for r in out if r['conf'] and r['conf'] != 'offmap')} on map); "
          f"{len(E)} edges; {sum(len(v) for v in att.values())} attestations in the collection")
    # expose the totals on the index for the home page
    ip = os.path.join(SITE, "public", "data", "index.json")
    I = json.load(open(ip))
    I["stats"]["places"] = len(out)
    I["stats"]["corpusTablets"] = ndocs
    json.dump(I, open(ip, "w"), ensure_ascii=False, separators=(",", ":"))
    missing = [k for k in G if k not in mentions]
    if missing:
        print("gazetteer keys with no mentions:", missing)


if __name__ == "__main__":
    main()
