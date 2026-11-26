#!/usr/bin/env python3
"""Render a private SwordWeave progression plan from standard input."""

import argparse
import json
import sys
from pathlib import Path

from character_pdf.render_progression import render


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    render(json.load(sys.stdin), parser.parse_args().output)
