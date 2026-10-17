"""Download public reference data, preserve provenance, and build local JSON indexes.

Python 3 standard library only. Default runs reproduce the manifest's hashes;
--refresh deliberately adopts the upstream release currently being served.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
from datetime import datetime, timezone
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "reference"
RKI_REPO = "robert-koch-institut/Gesundheitsberichterstattung_-_Daten_zu_nichtuebertragbaren_Erkrankungen"
RKI_TSV = "GBE_Indikatoren_nichtuebertragbarer_Erkrankungen.tsv"
ORPHA_PAGE = "https://sciences.orphadata.com/epidemiology/"
CC_BY = "https://creativecommons.org/licenses/by/4.0/"
MAX_BYTES = 64 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def retrieve(url):
    request = Request(url, headers={"User-Agent": "Arbor-reference-data/1.0", "Accept": "*/*"})
    with urlopen(request, timeout=45) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("Reference download exceeds size limit")
        return body, response.headers.get("Last-Modified")


def text(node, path):
    return (node.findtext(path) or "").strip()


def parse_orpha(english, german):
    root = ET.fromstring(english)
    german_names = {text(d, "OrphaCode"): text(d, "Name") for d in ET.fromstring(german).findall(".//Disorder")}
    entities = []
    for disorder in root.findall(".//Disorder"):
        code = text(disorder, "OrphaCode")
        if not code or not text(disorder, "Name"):
            raise ValueError("Invalid Orphadata entity")
        records = []
        for record in disorder.findall("PrevalenceList/Prevalence"):
            value_text = text(record, "ValMoy")
            value = float(value_text) if value_text else None
            records.append({
                "id": record.get("id"), "type": text(record, "PrevalenceType/Name"),
                "qualification": text(record, "PrevalenceQualification/Name"),
                "prevalenceClass": text(record, "PrevalenceClass/Name"),
                "rawValue": value, "geography": text(record, "PrevalenceGeographic/Name"),
                "validationStatus": text(record, "PrevalenceValidationStatus/Name"),
                "source": text(record, "Source"),
            })
        entities.append({
            "orphaCode": code, "names": {"en": text(disorder, "Name"), "de": german_names.get(code, "")},
            "url": f"https://www.orpha.net/en/disease/detail/{code}",
            "group": text(disorder, "DisorderGroup/Name"), "type": text(disorder, "DisorderType/Name"),
            "records": records,
        })
    if len(entities) < 1000 or not any(e["records"] for e in entities):
        raise ValueError("Incomplete Orphadata export")
    return {"schemaVersion": 1, "exportDate": root.get("date"), "entities": entities}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="adopt current upstream versions instead of reproducing the manifest")
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST / "manifest.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None
    pinned = previous if previous and not args.refresh else None
    now = datetime.now(timezone.utc).isoformat()
    if pinned:
        definitions = pinned["artifacts"]
        rki_commit = pinned["rkiCommit"]
        orpha_release = pinned["orphadataRelease"]
    else:
        commit_body, _ = retrieve(f"https://api.github.com/repos/{RKI_REPO}/commits/main")
        rki_commit = json.loads(commit_body)["sha"]
        if not re.fullmatch(r"[0-9a-f]{40}", rki_commit):
            raise ValueError("Invalid RKI commit identity")
        page_body, _ = retrieve(ORPHA_PAGE)
        release = re.search(r"Knowledge base release of\s+([^<\n]+)", page_body.decode("utf-8"))
        orpha_release = release.group(1).strip() if release else "See XML export date"
        base = f"https://raw.githubusercontent.com/{RKI_REPO}/{rki_commit}"
        definitions = [
            {"name": "orphadata-en.xml", "url": "https://www.orphadata.com/data/xml/en_product9_prev.xml", "license": CC_BY},
            {"name": "orphadata-de.xml", "url": "https://www.orphadata.com/data/xml/de_product9_prev.xml", "license": CC_BY},
            {"name": "rki-ncd.tsv", "url": f"{base}/{RKI_TSV}", "license": CC_BY},
            {"name": "rki-LICENSE.txt", "url": f"{base}/LICENSE", "license": CC_BY},
            {"name": "rki-methods.md", "url": f"{base}/Readme.md", "license": CC_BY},
        ]
    artifacts, bodies = [], {}
    # Publish the manifest last, after all downloads, parsing and checks succeed.
    with tempfile.TemporaryDirectory(prefix="sync-", dir=DEST) as temporary:
        stage = Path(temporary)
        for definition in definitions:
            name = definition["name"]
            if name not in {"orphadata-en.xml", "orphadata-de.xml", "rki-ncd.tsv", "rki-LICENSE.txt", "rki-methods.md"}:
                raise ValueError("Unexpected reference filename")
            existing = DEST / "raw" / name
            if pinned and existing.exists() and digest(existing.read_bytes()) == definition["sha256"]:
                body, last_modified = existing.read_bytes(), definition.get("lastModified")
                retrieved_at = definition["retrievedAt"]
            else:
                body, last_modified = retrieve(definition["url"])
                retrieved_at = now
            sha = digest(body)
            if pinned and sha != definition["sha256"]:
                raise ValueError(f"{name}: upstream bytes differ from the pinned release; use --refresh deliberately")
            bodies[name] = body
            (stage / name).write_bytes(body)
            artifacts.append({"name": name, "url": definition["url"], "license": CC_BY, "sha256": sha,
                              "bytes": len(body), "retrievedAt": retrieved_at, "lastModified": last_modified})
            print(f"Verified {name}: {len(body):,} bytes", flush=True)
        for name in ["orphadata-en.xml", "orphadata-de.xml"]:
            if b"creativecommons.org/licenses/by/4.0" not in bodies[name]:
                raise ValueError(f"{name}: embedded CC BY 4.0 licence not found")
        if b"Attribution 4.0 International" not in bodies["rki-LICENSE.txt"]:
            raise ValueError("RKI CC BY 4.0 licence not verified")
        orpha = parse_orpha(bodies["orphadata-en.xml"], bodies["orphadata-de.xml"])
        rki_rows = list(csv.DictReader(io.StringIO(bodies["rki-ncd.tsv"].decode("utf-8-sig")), delimiter="\t"))
        if not rki_rows or len(rki_rows[0]) < 10:
            raise ValueError("Invalid RKI TSV")
        indexes = {
            "orphadata-index.json": orpha,
            "rki-index.json": {"schemaVersion": 1, "columns": list(rki_rows[0]), "rows": rki_rows},
        }
        processed = []
        for name, content in indexes.items():
            body = json.dumps(content, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            (stage / name).write_bytes(body)
            processed.append({"name": name, "sha256": digest(body), "bytes": len(body)})
        manifest = {
            "schemaVersion": 1, "generatedAt": now, "orphadataRelease": orpha_release,
            "orphadataExportDate": orpha["exportDate"], "rkiCommit": rki_commit,
            "entityCount": len(orpha["entities"]), "rkiRows": len(rki_rows),
            "artifacts": artifacts, "processedFiles": processed,
            "sources": {"orphadata": ORPHA_PAGE, "rki": f"https://github.com/{RKI_REPO}"},
        }
        (DEST / "raw").mkdir(exist_ok=True)
        for artifact in artifacts:
            (stage / artifact["name"]).replace(DEST / "raw" / artifact["name"])
        for name in indexes:
            (stage / name).replace(DEST / name)
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        (stage / "manifest.json").replace(manifest_path)
    print(f"Ready: {len(orpha['entities']):,} Orphadata entities; {len(rki_rows):,} RKI rows. {DEST}")


if __name__ == "__main__":
    main()
