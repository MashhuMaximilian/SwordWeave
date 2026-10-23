#!/usr/bin/env python3
"""Render one character snapshot from stdin into a native character PDF.

Usage: python scripts/render-character-pdf.py --output /absolute/sheet.pdf
       [--manifest /absolute/sheet.json] < request.json
"""
import argparse
import json
import sys
from pathlib import Path

from character_pdf.renderer import render


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args()
    try:
        request = json.load(sys.stdin)
        result = render(request, args.output, args.manifest)
        print(json.dumps({k: result[k] for k in ('path', 'sha256', 'pages', 'options', 'chosen_density')}))
    except Exception as exc:
        print(f'Character PDF export failed: {type(exc).__name__}: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
