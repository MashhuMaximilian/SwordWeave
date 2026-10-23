"""Vercel native Python entry point; requests must be signed by the Next API."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

from character_pdf.transport_http import PdfRenderHandler


class handler(PdfRenderHandler):
    pass
