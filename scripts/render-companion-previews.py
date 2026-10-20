#!/usr/bin/env python3
"""Render creator-kit companion previews from their current PDF first pages.

Requires Poppler's pdftoppm and Pillow. Run before build-press-kit.py whenever a
companion PDF changes. This reads PDFs without modifying their form fields.
"""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PRESS = ROOT / "public" / "press"
SOURCE = PRESS / "press-kit.json"


def render(renderer):
    kit = json.loads(SOURCE.read_text())
    for material in kit["materials"]:
        asset = next(item for item in kit["assets"] if item.get("pdf") == material["pdf"])
        source = PRESS / material["pdf"]
        destination = PRESS / asset["file"]
        subprocess.run([
            renderer, "-f", "1", "-singlefile", "-jpeg", "-jpegopt", "quality=92",
            "-scale-to", "1200", str(source), str(destination.with_suffix("")),
        ], check=True)
        with Image.open(destination) as image:
            image.verify()
        with Image.open(destination) as image:
            asset["width"], asset["height"] = image.size
        asset["sourcePdfSha256"] = sha256(source.read_bytes()).hexdigest()
        print(f"Rendered {asset['file']} from {material['pdf']}, page 1")
    SOURCE.write_text(json.dumps(kit, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdftoppm", default=shutil.which("pdftoppm"))
    args = parser.parse_args()
    if not args.pdftoppm:
        parser.error("Install Poppler or pass --pdftoppm with its absolute executable path.")
    render(args.pdftoppm)
