#!/usr/bin/env python3
"""Build a compact cross-corpus line index from locally imported source files."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
catalogue = json.loads((DATA / "corpora/cmawro.json").read_text())
entries = {entry["id"]: entry for entry in catalogue["entries"]}
rows = []
units = []

for path in sorted((DATA / "corpora/cmawro/texts").glob("Q*.json")):
    doc = json.loads(path.read_text())
    meta = entries[doc["id"]]
    grouped = {}
    for line in doc["lines"]:
        label = line["label"]
        match = re.match(r"^(.+):[^:]+$", label)
        unit = match.group(1) if match else doc["id"]
        grouped.setdefault(unit, []).append(label)
        rows.append({
            "corpus": "cmawro", "id": doc["id"], "label": label,
            "reading": " ".join(word["reading"] for word in line["words"]),
            "lexical": " ".join(str(value) for word in line["words"] for value in (word.get("lemma"), word.get("gloss")) if value),
        })
    for unit, labels in grouped.items():
        units.append({"textId": doc["id"], "sourceUnit": unit, "firstLine": labels[0], "lastLine": labels[-1], "lineCount": len(labels), "category": meta["category"]})

index = json.loads((DATA / "index.json").read_text())
for meta in index["docs"]:
    doc = json.loads((DATA / "docs" / f"{meta['id']}.json").read_text())
    for line in doc["lines"]:
        words = [word for word in line["w"] if "r" in word]
        rows.append({
            "corpus": "hittite", "id": meta["id"], "label": line["n"],
            "reading": " ".join(word.get("tr") or "".join(run[0] for run in word["r"]) for word in words),
            "lexical": " ".join(str(value) for word in words for value in (word.get("l"), word.get("g"), word.get("gd")) if value),
        })

out = DATA / "corpora/search-lines.json"
out.write_text(json.dumps({"version": 1, "rows": rows}, ensure_ascii=False, separators=(",", ":")) + "\n")
unit_out = ROOT / "src/data/corpus-audits/cmawro-source-units.json"
unit_out.write_text(json.dumps({"method": "Distinct prefixes before the final colon in Oracc line labels; these are source numbering units, not classified procedures.", "units": units}, ensure_ascii=False, indent=2) + "\n")
print(f"Indexed {len(rows)} lines from two corpora; recorded {len(units)} CMAwRo source numbering units")
