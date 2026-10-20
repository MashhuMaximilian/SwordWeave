#!/usr/bin/env python3
"""Build the public creator kit from its checked-in originals, deterministically.

Run from any directory: python3 scripts/build-press-kit.py
This copies no private files, fetches nothing, and does not regenerate images.
"""
from datetime import datetime
from hashlib import sha256
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRESS = ROOT / "public" / "press"
SOURCE = PRESS / "press-kit.json"
ARCHIVE = PRESS / "swordweave-creator-kit-v0.1-alpha.zip"


def build():
    kit = json.loads(SOURCE.read_text())
    assets = []
    for item in kit["assets"]:
        path = PRESS / item["file"]
        if not path.is_file() or PRESS.resolve() not in path.resolve().parents:
            raise ValueError(f"Missing or invalid kit asset: {item['file']}")
        content = path.read_bytes()
        if item["kind"] == "companion":
            pdf = PRESS / item["pdf"]
            if not pdf.is_file() or sha256(pdf.read_bytes()).hexdigest() != item["sourcePdfSha256"]:
                raise ValueError(f"Stale companion preview: {item['file']}. Run render-companion-previews.py first.")
        assets.append({**item, "bytes": len(content), "sha256": sha256(content).hexdigest()})

    materials = []
    material_files = []
    for item in kit.get("materials", []):
        entry = dict(item)
        for key in ("pdf", "text"):
            path = PRESS / item[key]
            if not path.is_file() or PRESS.resolve() not in path.resolve().parents:
                raise ValueError(f"Missing or invalid companion: {item[key]}")
            content = path.read_bytes()
            entry[key + "Bytes"] = len(content)
            entry[key + "Sha256"] = sha256(content).hexdigest()
            material_files.append(path)
        materials.append(entry)

    manifest = {
        "project": kit["name"], "version": kit["version"], "updated": kit["updated"],
        "source": "https://www.swordweave.quest/press",
        "notice": "Read asset-notices.md. These files do not share one blanket license.",
        "assets": assets,
        "materials": materials,
    }
    (PRESS / "asset-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    facts = [f"# {kit['name']} creator fact sheet", f"{kit['version']} · Updated {kit['updated']}",
             "## One sentence", kit["oneLine"], "## Short description", kit["shortDescription"],
             "## Longer description", kit["longDescription"], "## Facts"]
    facts += [f"- **{item['label']}:** {item['value']}" for item in kit["facts"]]
    facts += ["## Original table companions", *[f"- [{item['title']}]({kit['website'].rstrip('/')}/press/{item['pdf']}): {item['pages']} pages. {item['description']} [Full text]({kit['website'].rstrip('/')}/press/{item['text']})" for item in materials],
              "## Alpha limitations", *[f"- {item}" for item in kit["limitations"]],
              "## Current books", *[f"- [{book['title']}](https://www.swordweave.quest{book['path']}): {book['status']}" for book in kit["books"]],
              "## Official links", *[f"- [{item['label']}]({item['url']})" for item in kit["links"]],
              f"- Email: {kit['email']}", "## AI and this alpha", *kit["aiDisclosure"],
              "## Licenses and credits",
              "Designated original game text and instructional diagrams use CC BY 4.0. Software uses MIT. Artwork, branding, fonts and third-party material keep their separate notices. See asset-notices.md and the source book credits; this kit does not add a standalone art license."]
    (PRESS / "fact-sheet.md").write_text("\n\n".join(facts) + "\n")
    captions = ["# Image captions and credits", f"SwordWeave {kit['version']} · {kit['updated']}"]
    for item in assets:
        captions += [f"## {item['label']}", f"File: `{item['file']}` · {item['width']} × {item['height']} nominal dimensions",
                     item["caption"], f"Credit: {item['credit']}", f"Source: {item['source']}", f"Rights: {item['rights']}"]
    (PRESS / "captions.md").write_text("\n\n".join(captions) + "\n")
    (PRESS / "repository-license.txt").write_bytes((ROOT / "LICENSE").read_bytes())

    files = [SOURCE, PRESS / "README.md", PRESS / "fact-sheet.md", PRESS / "captions.md",
             PRESS / "asset-notices.md", PRESS / "asset-manifest.json", PRESS / "repository-license.txt"]
    files += [PRESS / item["file"] for item in assets]
    files += material_files
    timestamp = (*datetime.fromisoformat(kit["updated"]).timetuple()[:3], 0, 0, 0)
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(files):
            info = zipfile.ZipInfo(f"swordweave-creator-kit/{path.relative_to(PRESS)}", date_time=timestamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    print(f"Built {ARCHIVE.relative_to(ROOT)}: {len(files)} files, {ARCHIVE.stat().st_size:,} bytes")
    print(f"SHA-256 {sha256(ARCHIVE.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    build()
