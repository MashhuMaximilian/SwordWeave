"""Load the approved native design methods without historical build side effects.

The v11 files are publication source, not executable application dependencies:
their top-level code registers temporary fonts and loads sample characters. Only
class/function definitions are compiled here. Runtime content and assets are
owned by renderer.py; no historical constructor or sample builder is invoked.
"""
from pathlib import Path
from types import SimpleNamespace
from xml.sax.saxutils import escape
import ast
import hashlib
import json
import math
import re

from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import Color
from reportlab.platypus import Paragraph
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[2]
STYLES = [
    ('aegis', 'Aegis', 'left', 'Architectural crystal armour'),
    ('vesper', 'Vesper', 'stack', 'Silver botanical filigree'),
    ('orrery', 'Orrery', 'right', 'Astronomical instruments'),
    ('moire', 'Moire', 'left', 'Interlaced silver ribbons'),
    ('serein', 'Serein', 'right', 'Lunar cathedral'),
    ('prism', 'Prism', 'left', 'Refracting quartz'),
    ('cipher', 'Cipher', 'left', 'Arcane circuitry'),
    ('helix', 'Helix', 'stack', 'Living biotechnology'),
    ('cinder', 'Cinder', 'left', 'Forged workshop'),
    ('nocturne', 'Nocturne', 'right', 'Eclipse and moth wing'),
    ('tidal', 'Tidal', 'stack', 'Oceanographic instruments'),
    ('solstice', 'Solstice', 'left', 'Solar Art Deco'),
]
AXES = [
    ('Targets', ['Single', 'Multiple', 'Area', 'Custom']),
    ('Shape', ['Direct', 'Cone', 'Line', 'Sphere', 'Zone', 'Beam', 'Custom']),
    ('Size', ['One target', '5 ft', '10 ft', '20 ft', 'Custom']),
    ('Placement', ['Self', 'Target', 'Point', 'Directional', 'Custom']),
    ('Effect duration', ['Instant', 'Short', 'Medium', 'Long', 'Scene', 'Persistent', 'Permanent', 'Custom']),
    ('Casting time', ['Action', 'Reaction', 'Instant', 'Short', 'Medium', 'Long', 'Scene', 'Custom']),
]
GROUPS = [('Physical', ['prowess', 'finesse', 'fieldcraft']),
          ('Mental', ['awareness', 'reason', 'knowledge', 'influence']),
          ('Magical', ['mysticism', 'communion', 'intuition'])]
RANGES = ['Touch', 'Close', 'Near', 'Far', 'Very Far', 'Extreme']
DISTANCES = ['5 ft', '5-10 ft', '30 ft', '60 ft', '120 ft', '240 ft-3 mi']
DICE = ['None', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20']
ACCESS = {'VERB_TIER', 'DOMAIN', 'RANGE', 'INTENSITY_DICE'}
TIER_LABELS = {'I': 'Tier 1', 'II': 'Tier 2', 'III': 'Tier 3', 'IV': 'Tier 4'}
ORGANIC = {'vesper', 'helix', 'nocturne', 'tidal', 'serein'}


def load_design():
    common = dict(Path=Path, escape=escape, hashlib=hashlib, json=json,
                  math=math, re=re, Image=Image, canvas=canvas,
                  pdfmetrics=pdfmetrics, ImageReader=ImageReader,
                  ParagraphStyle=ParagraphStyle, Paragraph=Paragraph,
                  Color=Color, PdfReader=PdfReader, PdfWriter=PdfWriter,
                  ROOT=ROOT, W=595.276, H=841.89, L=36., R=559.276,
                  GAP=15., CW=(559.276-36.-15.)/2, STYLES=STYLES,
                  AXES=AXES, GROUPS=GROUPS, RANGES=RANGES,
                  DISTANCES=DISTANCES, DICE=DICE, ACCESS=ACCESS,
                  TIER_LABELS=TIER_LABELS, ORGANIC=ORGANIC)
    modules = {}
    for version in range(6, 12):
        path = ROOT / f'scripts/build-character-sheet-v{version}.py'
        tree = ast.parse(path.read_text())
        definitions = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))]
        # source()/records() helpers are safe definitions; no top-level calls.
        namespace = dict(common, **modules)
        namespace['__name__'] = f'approved_character_design_v{version}'
        exec(compile(ast.Module(body=definitions, type_ignores=[]), str(path), 'exec'), namespace)
        modules[f'v{version}'] = SimpleNamespace(**namespace)
    return modules


MODULES = load_design()
APPROVED_FOLIO = MODULES['v11'].Folio


def set_panel_dimensions(width, height, margin=36.):
    """The design methods use native top-left point coordinates per panel."""
    for module in MODULES.values():
        for value in vars(module).values():
            if callable(value) and hasattr(value, '__globals__'):
                value.__globals__.update(W=width, H=height, L=margin,
                                         R=width-margin, GAP=15.,
                                         CW=(width-2*margin-15.)/2)
        for cls in vars(module).values():
            if isinstance(cls, type) and cls.__module__.startswith('approved_character_design'):
                for value in vars(cls).values():
                    if callable(value) and hasattr(value, '__globals__'):
                        value.__globals__.update(W=width, H=height, L=margin,
                                                 R=width-margin, GAP=15.,
                                                 CW=(width-2*margin-15.)/2)
