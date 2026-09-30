#!/usr/bin/env python3
"""Convert CC0 CMAwRo master-text JSON to compact, line-anchored readings.

Usage: python3 scripts/import-cmawro-texts.py /path/to/cmawro-cmawr1.zip ...
The Oracc `frag` field is an edited word reading, not a diplomatic sign copy.
"""

import argparse
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data/corpora/cmawro/texts"


def lines_from(edition):
    lines = []
    current = None

    def visit(item):
        nonlocal current
        if isinstance(item, list):
            for child in item: visit(child)
        elif isinstance(item, dict):
            if item.get("node") == "d" and item.get("type") == "line-start" and item.get("label"):
                current = {"ref": item.get("ref"), "label": item["label"], "words": []}
                lines.append(current)
            elif item.get("node") == "l":
                if current is None:
                    current = {"ref": item.get("ref", "").split(".")[0], "label": "Unlabelled", "words": []}
                    lines.append(current)
                form = item.get("f") or {}
                current["words"].append({
                    "id": item.get("id"), "reading": item.get("frag") or form.get("norm") or "?",
                    "lemma": form.get("cf"), "gloss": form.get("gw"),
                    "language": form.get("lang"), "partOfSpeech": form.get("pos"),
                })
            visit(item.get("cdl", []))

    visit(edition.get("cdl", []))
    return [line for line in lines if line["words"]]


def import_archives(paths):
    OUT.mkdir(parents=True, exist_ok=True)
    total_texts = total_words = 0
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            manifests = [name for name in archive.namelist() if name.endswith("/corpus.json")]
            if len(manifests) != 1: raise ValueError(f"Expected one corpus manifest in {path}")
            manifest_path = manifests[0]
            prefix = manifest_path.removesuffix("corpus.json")
            corpus = json.loads(archive.read(manifest_path))
            for text_id, relative in corpus["members"].items():
                if not text_id.startswith("Q"): continue
                raw = archive.read(prefix + relative)
                edition = json.loads(raw) if raw else {}
                if raw and edition.get("license-url") != "https://creativecommons.org/publicdomain/zero/1.0/":
                    raise ValueError(f"Unexpected licence on {text_id}")
                lines = lines_from(edition)
                nwords = sum(len(line["words"]) for line in lines)
                target = OUT / f"{text_id}.json"
                target.write_text(json.dumps({
                    "id": text_id, "sourceUrl": f"https://oracc.museum.upenn.edu/{corpus['project']}/{text_id}",
                    "sourceArchiveTimestamp": corpus.get("UTC-timestamp"), "readingType": "edited word readings",
                    "lines": lines,
                }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
                total_texts += 1
                total_words += nwords
    print(f"Wrote {total_texts} master-text files with {total_words} word readings to {OUT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archives", nargs="+", help="CMAwRo volume and Maqlû archives")
    import_archives(parser.parse_args().archives)
