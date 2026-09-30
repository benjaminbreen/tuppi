#!/usr/bin/env python3
"""Build a compact CMAwRo metadata index from official Oracc JSON archives.

Usage: python3 scripts/import-cmawro-metadata.py --top cmawro.zip --volumes cmawro-cmawr1.zip cmawro-cmawr2.zip cmawro-cmawr3.zip cmawro-maqlu.zip cmawro-sources.zip
Only metadata, counts, and links are published. Transliterations remain in the source archives.
"""

import argparse
import json
import pathlib
import zipfile
from importlib.machinery import SourceFileLoader

ROOT = pathlib.Path(__file__).resolve().parents[1]
auditor = SourceFileLoader("oracc_audit", str(ROOT / "scripts/audit-oracc-archive.py")).load_module()


def build(top_path, volume_paths):
    summary, masters = auditor.audit(volume_paths)
    with zipfile.ZipFile(top_path) as archive:
        _, catalogue = auditor.catalogue_in(archive)
    witnesses = {}
    for source_id, record in catalogue["members"].items():
        if not source_id.startswith("P"):
            continue
        refs = record.get("qcat_2__id_composite") or []
        if isinstance(refs, str): refs = [refs]
        for ref in refs:
            if ref in masters:
                witnesses.setdefault(ref, []).append({"id": source_id, "period": record.get("period"), "findspot": record.get("provenience")})

    entries = []
    for text_id, item in sorted(masters.items()):
        record = item["catalogue"]
        project = item["project"]
        linked = witnesses.get(text_id, [])
        entries.append({
            "id": text_id,
            "sourceUrl": f"https://oracc.museum.upenn.edu/{project}/{text_id}",
            "title": record.get("c_name") or record.get("other_names") or record.get("designation") or text_id,
            "seriesId": record.get("external_id") or record.get("designation") or text_id,
            "edition": record.get("primary_edition"),
            "group": str(record.get("c_group") or "?"),
            "category": record.get("subgenre"),
            "genre": record.get("genre"),
            "tokenCount": item.get("tokens", 0),
            "lineStartCount": item.get("lineStarts", 0),
            "englishOnOracc": "en" in record.get("trans", []),
            "witnessCount": len(linked),
            "witnessPeriods": sorted({w["period"] for w in linked if w["period"]}),
            "findspots": sorted({w["findspot"] for w in linked if w["findspot"]}),
        })
    output = {
        "corpusId": "cmawro",
        "sourceUrl": "https://oracc.museum.upenn.edu/json/",
        "sourceArchiveTimestamp": max(a["archiveTimestamp"] for a in summary["archives"] if a["archiveTimestamp"]),
        "license": summary["declaredLicenses"],
        "stats": {key: value for key, value in summary.items() if key in ("masterTextEditions", "masterTextsWithTokens", "masterTextsMarkedEnglishTranslation", "sourceWitnessEditions", "sourceWitnessesWithTokens", "emptyEditionIds")},
        "entries": entries,
    }
    if len(entries) != 264:
        raise ValueError(f"Expected 264 CMAwRo master texts, got {len(entries)}")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", required=True, help="Top-level cmawro.zip")
    parser.add_argument("--volumes", nargs="+", required=True, help="Volume, Maqlû and sources archives")
    args = parser.parse_args()
    output = build(args.top, args.volumes)
    target = ROOT / "public/data/corpora/cmawro.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(output['entries'])} master-text metadata records to {target}")
