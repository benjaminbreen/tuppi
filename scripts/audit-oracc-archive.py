#!/usr/bin/env python3
"""Inspect official Oracc JSON ZIPs without copying editions into public/data.

Usage: python3 scripts/audit-oracc-archive.py /path/to/cmawro-cmawr1.zip [...]
"""

import argparse
import collections
import json
import zipfile


def catalogue_in(archive):
    names = [name for name in archive.namelist() if name.endswith("/catalogue.json")]
    if len(names) != 1:
        raise ValueError(f"Expected one catalogue.json, found {len(names)}: {names}")
    return names[0], json.loads(archive.read(names[0]))


def node_counts(value):
    counts = collections.Counter()
    def visit(item):
        if isinstance(item, dict):
            if item.get("node") == "l": counts["tokens"] += 1
            elif item.get("node") == "d" and item.get("type") == "line-start": counts["lineStarts"] += 1
            for child in item.values(): visit(child)
        elif isinstance(item, list):
            for child in item: visit(child)
    visit(value.get("cdl", []))
    return counts


def audit(paths):
    masters, sources, archives, licenses, empty_editions = {}, {}, [], set(), []
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            catalogue_path, catalogue = catalogue_in(archive)
            prefix = catalogue_path.removesuffix("catalogue.json")
            corpus = json.loads(archive.read(prefix + "corpus.json"))
            if not isinstance(catalogue.get("members"), dict) or not isinstance(corpus.get("members"), dict):
                raise ValueError(f"Malformed Oracc manifest in {prefix}")
            archives.append({"path": path, "project": corpus.get("project"), "catalogueEntries": len(catalogue["members"]), "editionJsonFiles": len(corpus["members"]), "archiveTimestamp": corpus.get("UTC-timestamp")})
            licenses.add((corpus.get("license"), corpus.get("license-url")))
            names = set(archive.namelist())
            for text_id, relative in corpus["members"].items():
                filename = prefix + relative
                if filename not in names: raise ValueError(f"Missing edition {filename}")
                raw = archive.read(filename)
                if not raw:
                    empty_editions.append(text_id)
                    edition = {}
                else:
                    edition = json.loads(raw)
                    licenses.add((edition.get("license"), edition.get("license-url")))
                info = {"id": text_id, "project": corpus.get("project"), "catalogue": catalogue["members"].get(text_id, {}), **node_counts(edition)}
                target = masters if text_id.startswith("Q") else sources
                if text_id in target: raise ValueError(f"Duplicate edition ID {text_id}")
                target[text_id] = info
    categories = collections.Counter(str(item["catalogue"].get("c_group") or item["catalogue"].get("group") or "unknown") for item in masters.values())
    genres = collections.Counter(str(item["catalogue"].get("genre") or "unspecified") for item in masters.values())
    result = {
        "archives": archives,
        "masterTextEditions": len(masters),
        "masterTextsWithTokens": sum(item.get("tokens", 0) > 0 for item in masters.values()),
        "masterTextsMarkedEnglishTranslation": sum("en" in item["catalogue"].get("trans", []) for item in masters.values()),
        "masterTextTokenTotal": sum(item.get("tokens", 0) for item in masters.values()),
        "sourceWitnessEditions": len(sources),
        "sourceWitnessesWithTokens": sum(item.get("tokens", 0) > 0 for item in sources.values()),
        "emptyEditionIds": empty_editions,
        "categories": dict(sorted(categories.items())),
        "genres": dict(genres.most_common()),
        "declaredLicenses": [{"label": label, "url": url} for label, url in sorted(licenses)],
        "eligibleProcedures": None,
        "note": "Master texts, manuscript sources, translated flags and individual procedures are different units. Segmentation is still required.",
    }
    return result, masters


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archives", nargs="+", help="Official Oracc JSON ZIPs")
    args = parser.parse_args()
    result, _ = audit(args.archives)
    print(json.dumps(result, ensure_ascii=False, indent=2))
