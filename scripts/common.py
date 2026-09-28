import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gloss_en_1 import G as G1
from gloss_en_2 import G as G2
from gloss_en_3 import G as G3
from gloss_en_4 import G as G4
from gloss_en_5 import G as G5
GLOSS_EN = {**G1, **G2, **G3, **G4, **G5}

def en(g):
    g = (g or "").strip()
    if g in GLOSS_EN:
        return GLOSS_EN[g]
    return g  # proper names and untranslated fall through unchanged

def chosen(word):
    """Return (analysis, certainty) where certainty in {'sel','single','ambig','none'}."""
    alts = word.get("a", [])
    sel = word.get("sel", "")
    m = re.match(r"^(\d+)", sel)
    if m and alts:
        k = int(m.group(1)) - 1
        if 0 <= k < len(alts):
            return alts[k], "sel"
    if len(alts) == 1:
        return alts[0], "single"
    if alts:
        return alts[0], "ambig"
    return None, "none"
