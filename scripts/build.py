"""Stage 2: turn build/extract.json into the site's static JSON (public/data/).

Outputs
  public/data/index.json        compositions, manuscripts, stats
  public/data/docs/<slug>.json  one manuscript: lines, words (runs + analysis + tags), paragraphs
  public/data/substances.json   substance ledger with attestations (KWIC)
  public/data/lexicon.json      every lemma in the slice with gloss + counts
  public/data/fingerprints.json paragraph-level summaries for the browser
"""
import collections
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import chosen, en  # noqa: E402
from substances import ACTIONS, EXCLUDE, S  # noqa: E402

SITE = os.path.join(HERE, "..")
OUT = os.path.join(SITE, "public", "data")
RESEARCH = os.path.join(SITE, "..", "hittite-tlhdig", "data")

GROUPS = [
    {"id": "plague-ritual", "label": "Plague & army rituals",
     "blurb": "Rituals performed when 'there is dying in the land or in the army camp', many attributed to experts from Arzawa, Ḫapalla and Kizzuwatna."},
    {"id": "plague-prayer", "label": "Plague prayers",
     "blurb": "Muršili II's prayers during a twenty-year epidemic, blaming it on broken oaths and prisoners brought home from war."},
    {"id": "medicine", "label": "Hittite medicine & materia",
     "blurb": "Medical prescriptions and lists of magical substances in Hittite."},
    {"id": "akkadian-medicine", "label": "Babylonian medicine at Ḫattuša",
     "blurb": "Akkadian prescriptions and rituals copied at the Hittite capital, one with Hittite and Luwian glosses."},
    {"id": "healing-ritual", "label": "Healing & counter-sorcery",
     "blurb": "Rituals of named practitioners against bewitchment, impurity and impotence."},
]

COMPOSITIONS = {
    "378": {"title": "Plague Prayers of Muršili II", "who": "Muršili II", "from": "Ḫattuša", "concern": "a twenty-year epidemic"},
    "394": {"title": "Ritual of Ašḫella", "who": "Ašḫella, man of Ḫapalla", "from": "Ḫapalla (west)", "concern": "dying in the land or the army camp"},
    "407": {"title": "Ritual of Puliša", "who": "Puliša", "from": "", "concern": "plague brought in from an enemy land"},
    "410": {"title": "Ritual of Uḫḫamuwa", "who": "Uḫḫamuwa, man of Arzawa", "from": "Arzawa (west)", "concern": "dying in the land, caused by an enemy god"},
    "424": {"title": "Rituals against plague", "who": "", "from": "", "concern": "plague"},
    "425": {"title": "Rituals against plague in the army", "who": "incl. Madduwani & Dandanku, augurs", "from": "Arzawa (west)", "concern": "plague in the army"},
    "426": {"title": "Rituals for a defeated army", "who": "", "from": "", "concern": "an army defeated in battle"},
    "757": {"title": "Ritual of Zarpiya", "who": "Zarpiya, physician (A.ZU)", "from": "Kizzuwatna (south-east)", "concern": "a bad year, dying in the land"},
    "460": {"title": "Lists of magical substances", "who": "", "from": "", "concern": "inventories of ritual materia"},
    "461": {"title": "Medical texts", "who": "", "from": "", "concern": "prescriptions"},
    "783": {"title": "Medical rituals of Zelliya", "who": "Zelliya", "from": "", "concern": "medical rituals"},
    "802": {"title": "Ritual against impotence (Akkadian)", "who": "", "from": "Babylonian tradition", "concern": "impotence"},
    "808": {"title": "Akkadian medical text with Hittite and Luwian glosses", "who": "", "from": "Babylonian tradition", "concern": "prescriptions, glossed"},
    "809": {"title": "Akkadian prescriptions for eye disease", "who": "", "from": "Babylonian tradition", "concern": "eye disease"},
    "811": {"title": "Akkadian prescriptions against fever", "who": "", "from": "Babylonian tradition", "concern": "fever"},
    "402": {"title": "Ritual of Alli", "who": "Alli, woman of Arzawa", "from": "Arzawa (west)", "concern": "bewitchment"},
    "406": {"title": "Ritual of Paškuwatti", "who": "Paškuwatti, woman of Arzawa", "from": "Arzawa (west)", "concern": "impotence"},
    "409": {"title": "Rituals of Tunnawiya", "who": "Tunnawiya, the Old Woman", "from": "Lower Land (Luwian)", "concern": "impurity, illness"},
}

PERIOD = {"ah": "OS", "mh": "MS", "jh": "NS", "sj": "LNS"}  # Old / Middle / New / late New script


def slug(s):
    s = s.replace("+", " plus ").replace("(", "").replace(")", "")
    s = re.sub(r"[^\w]+", "-", s.lower()).strip("-")
    return s


def det_strings(runs):
    out, cur = [], ""
    for t, st, k in runs:
        if k == "det":
            cur += t
        else:
            if cur:
                out.append(cur)
                cur = ""
    if cur:
        out.append(cur)
    return [d.strip() for d in out if d.strip()]


def written_form(runs):
    return "".join(t for t, st, k in runs).strip()


def preserved_state(runs):
    chars = [(st, len(t)) for t, st, k in runs if k != "corr"]
    tot = sum(n for s, n in chars)
    br = sum(n for s, n in chars if s == "b")
    if tot == 0:
        return "b"
    if br == 0:
        return "o"
    if br == tot:
        return "b"
    return "p"


PREP = re.compile(r"^(ŠA|A-NA|I-NA|IŠ-TU|IT-TI|ANA|IŠTU|INA|A-NA-KU|PA-NI|ŠA-A)\s+")


def form_key(runs):
    s = "".join(t for t, st, k in runs if k != "corr")
    s = re.sub(r"[\[\]⸢⸣?!°〈〉«»]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def logo_core(runs):
    """Sumerogram core of a word: no determinatives, no Akkadian preposition, no Hittite/Akkadian complement."""
    s = "".join(t for t, st, k in runs if k in ("sum",))
    s = re.sub(r"[\[\]⸢⸣?!°〈〉«»\s]", "", s).strip("-.")
    return s


def short_morph(m):
    m = (m or "").strip()
    n = m.count("→")
    if n > 3:
        return "case not marked"
    if n:
        return " / ".join(x.strip() for x in re.findall(r"→\s*([^}]+)", m))
    return m


def status_of(gloss):
    g = (gloss or "").strip()
    if not g:
        return "unglossed"
    if re.fullmatch(r"\(.*\)", g):
        return "class-only"
    if "?" in g:
        return "tentative"
    return "identified"


def renumber(t):
    def one(m):
        a = int(m.group(2)) + 1
        b = f"{m.group(3)}{int(m.group(4)) + 1}" if m.group(4) else ""
        return f"{m.group(1)}{a}{b}"
    return re.sub(r"(§§?\s?)(\d+)(?:(\s?[–-]\s?)(\d+))?", one, t)


def load_konk():
    p = os.path.join(RESEARCH, "konk_sections.json")
    if not os.path.exists(p):
        return {}
    S_ = json.load(open(p))
    heads, bypub = {}, {}
    for rows in S_.values():
        head = None
        for r in rows:
            if r["head"]:
                head = r
            pub = re.sub(r"\s+", " ", r["publ"]).strip()
            if pub and pub != ".":
                bypub.setdefault(pub, head or r)
    return bypub


def main():
    E = json.load(open(os.path.join(SITE, "build", "extract.json")))
    FD = json.load(open(os.path.join(SITE, "build", "formdict.json")))
    konk = load_konk()
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "docs"))

    lex = {}
    subs = {}
    docs_meta = []
    fps = []
    comp_docs = collections.defaultdict(list)

    for d in E["docs"]:
        if not d["docid"] or not re.match(r"^[A-Za-z]", d["docid"]):
            d["docid"] = os.path.splitext(os.path.basename(d["path"]))[0]
        sl = slug(d["docid"])
        pubs = [re.sub(r"\{[^}]*\}", "", p).strip() for p in d["pubs"]] or [d["docid"]]
        k = None
        for p in pubs + [re.sub(r"\+$", "", d["docid"] or "")]:
            if p in konk:
                k = konk[p]
                break
        period = PERIOD.get((k or {}).get("zeit", "")[:2].lower().replace("sj", "sj"), None) if k else None
        if k and k.get("zeit", "").lower().startswith("sjh"):
            period = "LNS"
        lines_out = []
        chars_tot = chars_pres = 0
        for li, L in enumerate(d["lines"]):
            words = []
            for wi, t in enumerate(L["t"]):
                if "gap" in t:
                    words.append({"gap": t["gap"]})
                    continue
                runs = t["r"]
                for tx, st, kd in runs:
                    if kd != "corr":
                        chars_tot += len(tx)
                        chars_pres += len(tx) if st != "b" else 0
                a, cert = chosen(t)
                dets = det_strings(runs)
                w = {"r": runs, "p": preserved_state(runs)}
                if t.get("tr"):
                    w["tr"] = t["tr"]
                cls = None
                if "D" in dets:
                    cls = "deity"
                elif "m" in dets or "f" in dets:
                    cls = "person"
                elif any(x in ("URU", "KUR", "ÍD", "ḪUR.SAG") for x in dets):
                    cls = "place"
                if a is None:
                    fd = FD.get(form_key(runs))
                    if fd:
                        a = {"lemma": fd[0], "gloss": fd[1], "morph": fd[2], "stem": "", "det": ""}
                        cert = "form"
                if a:
                    lemma = a["lemma"]
                    w.update({"l": lemma, "g": en(a["gloss"]), "gd": a["gloss"], "m": short_morph(a["morph"]),
                              "c": {"sel": "e", "single": "1", "ambig": "a", "form": "f"}[cert]})
                    if cert == "ambig":
                        w["alt"] = [[x["lemma"], en(x["gloss"])] for x in t["a"][:5]]
                    e = lex.setdefault(lemma, {"lemma": lemma, "g": en(a["gloss"]), "gd": a["gloss"], "n": 0, "docs": set(), "refs": []})
                    e["n"] += 1
                    e["docs"].add(sl)
                    if len(e["refs"]) < 400:
                        e["refs"].append([sl, li, wi])
                else:
                    lemma = None
                    if t.get("sel") in ("AKK", "HUR", "SUM"):
                        w["lang"] = t["sel"].lower()
                # substance tagging
                sid = None
                human = any(x in ("LÚ", "MUNUS", "LÚ.MEŠ", "MUNUS.MEŠ", "D") or x.startswith("LÚ") or x.startswith("MUNUS") for x in dets)
                if human:
                    pass
                elif lemma and lemma not in EXCLUDE and lemma in S:
                    ent = S[lemma]
                    need = ent[2] if len(ent) > 2 else None
                    if need is None or need in dets:
                        sid = "s:" + lemma
                        sclass, slabel = ent[0], ent[1]
                        sg = a["gloss"]
                elif (lemma is None or lemma not in S) and logo_core(runs) in S and logo_core(runs) not in EXCLUDE:
                    core = logo_core(runs)
                    ent = S[core]
                    need = ent[2] if len(ent) > 2 else None
                    if need is None or need in dets:
                        sid = "s:" + core
                        sclass, slabel = ent[0], ent[1]
                        sg = (a or {}).get("gloss", "") if a and a.get("lemma", "").rstrip("=") == core else ""
                        lemma = lemma or core
                elif not lemma and any(x in ("Ú", "SAR") for x in dets):
                    form = written_form([r_ for r_ in runs if r_[2] != "det"])
                    if form and form.lower() not in ("x", "xx"):
                        sid = "w:" + form
                        sclass, slabel, sg = "plant", form, ""
                if sid and cls is None:
                    w["s"] = sid
                    cls = sclass
                    se = subs.setdefault(sid, {"id": sid, "lemma": lemma or slabel, "label": slabel, "class": sclass,
                                               "gloss_de": sg, "status": status_of(slabel) if sid.startswith("s:") else "unglossed",
                                               "forms": collections.Counter(), "att": [], "docs": set(), "cth": collections.Counter()})
                    se["forms"][written_form(runs)] += 1
                    se["att"].append([sl, li, wi])
                    se["docs"].add(sl)
                    se["cth"][d["cth"]] += 1
                if cls:
                    w["k"] = cls
                words.append(w)
            lines_out.append({"n": L["n"], "lg": L["lg"], "cu": L["cu"], "rule": L["rule"], "w": words})
        pres = round(chars_pres / chars_tot, 3) if chars_tot else 0

        # paragraphs + fingerprint
        paras, cur = [], [0, None]
        for li, L in enumerate(lines_out):
            if L["rule"]:
                paras.append([cur[0], li, L["rule"]])
                cur = [li + 1, None]
        if cur[0] < len(lines_out):
            paras.append([cur[0], len(lines_out) - 1, 0])
        fp = []
        for a0, a1, rule in paras:
            f = {"a": a0, "b": a1, "s": [], "act": collections.Counter(), "dei": 0, "lg": set(), "pw": 0, "nw": 0}
            for li in range(a0, a1 + 1):
                L = lines_out[li]
                if L["lg"] and L["lg"] != "Hit":
                    f["lg"].add(L["lg"])
                for w in L["w"]:
                    if "r" not in w:
                        continue
                    f["nw"] += 1
                    f["pw"] += 1 if w["p"] != "b" else 0
                    if w.get("s"):
                        f["s"].append([w["k"], w["s"]])
                    if w.get("k") == "deity":
                        f["dei"] += 1
                    g = w.get("g", "")
                    if g and w.get("m"):
                        for act, pat in ACTIONS.items():
                            if re.search(pat, g):
                                f["act"][act] += 1
                                break
            fp.append({"a": a0, "b": a1, "s": f["s"], "act": dict(f["act"]), "dei": f["dei"], "lg": sorted(f["lg"]),
                       "pres": round(f["pw"] / f["nw"], 2) if f["nw"] else 0, "nw": f["nw"]})

        meta = {"id": sl, "docid": d["docid"], "cth": d["cth"], "group": d["group"], "pubs": pubs,
                "nlines": len(lines_out), "pres": pres, "period": period,
                "inv": (k or {}).get("inv"), "cthSub": (k or {}).get("cth"), "zeit": (k or {}).get("zeit"),
                "find": (k or {}).get("fund", "")[:160] if k else None,
                "note": re.sub(r"\s*;\s*ↂ.*$", "", (k or {}).get("anm", ""))[:400] if k else None,
                "project": d["project"]}
        docs_meta.append(meta)
        comp_docs[d["cth"]].append(meta)
        json.dump({**meta, "lines": lines_out, "paras": paras}, open(os.path.join(OUT, "docs", sl + ".json"), "w"),
                  ensure_ascii=False, separators=(",", ":"))
        fps.append({"id": sl, "cth": d["cth"], "paras": fp})

    # substance ledger with KWIC
    docs_cache = {}

    def doc(sl):
        if sl not in docs_cache:
            docs_cache[sl] = json.load(open(os.path.join(OUT, "docs", sl + ".json")))
        return docs_cache[sl]

    def plain(w):
        if "gap" in w:
            return "…"
        return "".join(("[" + t + "]") if st == "b" else t for t, st, k in w["r"]).replace("][", "")

    sub_out = []
    for sid, se in subs.items():
        att = []
        for sl, li, wi in se["att"][:400]:
            D = doc(sl)
            words = D["lines"][li]["w"]
            left = " ".join(plain(w) for w in words[max(0, wi - 4):wi])
            right = " ".join(plain(w) for w in words[wi + 1:wi + 5])
            att.append({"d": sl, "docid": D["docid"], "cth": D["cth"], "li": li, "wi": wi, "n": D["lines"][li]["n"],
                        "left": left, "kw": plain(words[wi]), "right": right, "p": words[wi]["p"]})
        sub_out.append({"id": sid, "lemma": se["lemma"], "label": se["label"], "class": se["class"],
                        "glossDe": se["gloss_de"], "status": se["status"], "n": len(se["att"]),
                        "nPreserved": sum(1 for x in att if x["p"] != "b"),
                        "forms": [f for f, _ in se["forms"].most_common(6)],
                        "docs": len(se["docs"]), "cth": dict(se["cth"]), "att": att})
    sub_out.sort(key=lambda s: (-s["n"], s["label"]))
    json.dump(sub_out, open(os.path.join(OUT, "substances.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    lex_out = sorted(({"lemma": v["lemma"], "g": v["g"], "gd": v["gd"], "n": v["n"], "docs": len(v["docs"])}
                      for v in lex.values()), key=lambda x: -x["n"])
    json.dump(lex_out, open(os.path.join(OUT, "lexicon.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump({v["lemma"]: v["refs"] for v in lex.values()}, open(os.path.join(OUT, "lexrefs.json"), "w"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(fps, open(os.path.join(OUT, "fingerprints.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    comps = []
    for g in GROUPS:
        for cth in [c for c, m in COMPOSITIONS.items()]:
            if not comp_docs.get(cth) or comp_docs[cth][0]["group"] != g["id"]:
                continue
            ds = sorted(comp_docs[cth], key=lambda m: -m["nlines"])
            per = collections.Counter(m["period"] or "?" for m in ds)
            comps.append({"cth": cth, "group": g["id"], **COMPOSITIONS[cth], "docs": [m["id"] for m in ds],
                          "nDocs": len(ds), "periods": dict(per), "nLines": sum(m["nlines"] for m in ds)})
    stats = {"docs": len(docs_meta), "lines": sum(m["nlines"] for m in docs_meta),
             "words": sum(1 for f in fps for p in f["paras"] for _ in range(p["nw"])),
             "substances": len(sub_out), "lemmas": len(lex_out), "compositions": len(comps)}
    # translations (hand-made drafts live in translations/, copied here with an index)
    tdir = os.path.join(SITE, "translations")
    os.makedirs(os.path.join(OUT, "tr"), exist_ok=True)
    tindex = {}
    for f in sorted(os.listdir(tdir)) if os.path.isdir(tdir) else []:
        if not f.endswith(".json"):
            continue
        T = json.load(open(os.path.join(tdir, f)))
        # translators cite paragraphs by the worksheet's 0-based index; readers see 1-based numbers
        T["intro"] = renumber(T.get("intro", ""))
        for P in T.get("paras", []):
            P["en"] = renumber(P["en"])
        for S_ in T.get("sections", []):
            S_["title"] = renumber(S_["title"])
        json.dump(T, open(os.path.join(OUT, "tr", f), "w"), ensure_ascii=False, separators=(",", ":"))
        tindex[T["doc"]] = {"status": T.get("status", "draft"), "paras": len(T.get("paras", []))}
    json.dump(tindex, open(os.path.join(OUT, "tr", "index.json"), "w"), ensure_ascii=False)
    stats["translated"] = len(tindex)
    json.dump({"groups": GROUPS, "compositions": comps, "docs": docs_meta, "stats": stats,
               "built": __import__("datetime").date.today().isoformat()},
              open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(stats))
    print(collections.Counter(s["class"] for s in sub_out), collections.Counter(s["status"] for s in sub_out))


if __name__ == "__main__":
    main()
