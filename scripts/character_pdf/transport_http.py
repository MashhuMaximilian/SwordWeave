"""Private signed transport for Vercel's native Python PDF function.

Authorization and canonical character projection remain in Next. This function
accepts only a short-lived HMAC of the exact server-produced request bytes.
It has no database access, cookies, storage uploads, or authored-text logging.
"""
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import hmac
import json
import os
import re
import threading
import time

HOSTED_MAX_BYTES = 4_300_000
SIGNATURE_MAX_AGE_SECONDS = 120
_render_lock = threading.BoundedSemaphore(1)
_PRIVATE_HEADERS = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
}


@dataclass
class RenderResponse:
    status: int
    headers: dict
    body: bytes


def error_response(status, message):
    headers = dict(_PRIVATE_HEADERS, **{'Content-Type': 'application/json'})
    if status == 429:
        headers['Retry-After'] = '2'
    return RenderResponse(status, headers, json.dumps({'error': message}).encode('utf-8'))


def _render(request, output):
    # Failed authentication must not import the design engine or load assets.
    from .renderer import render
    render(request, output)


def process_request(body, headers, *, secret=None, now=None, render_impl=None):
    """Return a safe response; diagnostic exceptions never leave this boundary."""
    if len(body) > HOSTED_MAX_BYTES:
        return error_response(413, 'The character exceeds the hosted PDF size limit. No rules were omitted.')
    secret = os.environ.get('SWORDWEAVE_PDF_RENDER_SECRET', '') if secret is None else secret
    if not isinstance(secret, str) or len(secret) < 32:
        return error_response(503, 'PDF export is temporarily unavailable.')
    timestamp = headers.get('X-SwordWeave-PDF-Timestamp', '')
    signature = headers.get('X-SwordWeave-PDF-Signature', '')
    if not re.fullmatch(r'[0-9]{1,12}', timestamp) or not re.fullmatch(r'[0-9a-f]{64}', signature):
        return error_response(401, 'Unauthorized PDF renderer request.')
    current = time.time() if now is None else now
    if abs(current - int(timestamp)) > SIGNATURE_MAX_AGE_SECONDS:
        return error_response(401, 'Unauthorized PDF renderer request.')
    expected = hmac.new(secret.encode('utf-8'), timestamp.encode('ascii') + b'\n' + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return error_response(401, 'Unauthorized PDF renderer request.')
    if headers.get('Content-Type', '').split(';', 1)[0].strip().lower() != 'application/json':
        return error_response(415, 'Expected a JSON PDF request.')
    try:
        request = json.loads(body)
        if not isinstance(request, dict) or set(request) != {'character', 'options'}:
            raise ValueError()
        if not isinstance(request['character'], dict) or not isinstance(request['options'], dict):
            raise ValueError()
    except (UnicodeError, ValueError, TypeError, RecursionError):
        return error_response(400, 'Invalid PDF renderer request.')
    # Approved design methods mutate shared physical-page dimensions. A single
    # warm Python process must never render different orientations concurrently.
    if not _render_lock.acquire(blocking=False):
        return error_response(429, 'The PDF renderer is busy. Please try again shortly.')
    try:
        with TemporaryDirectory(prefix='swordweave-character-pdf-') as directory:
            output = Path(directory) / 'sheet.pdf'
            (render_impl or _render)(request, output)
            if not output.is_file():
                return error_response(503, 'The character PDF could not be prepared.')
            if output.stat().st_size > HOSTED_MAX_BYTES:
                return error_response(413, 'The character exceeds the hosted PDF size limit. No rules were omitted.')
            data = output.read_bytes()
            if not data.startswith(b'%PDF-'):
                return error_response(503, 'The character PDF could not be prepared.')
            return RenderResponse(200, dict(_PRIVATE_HEADERS, **{'Content-Type': 'application/pdf'}), data)
    except Exception:
        # Renderer diagnostics can contain private authored text.
        return error_response(503, 'The character PDF could not be prepared.')
    finally:
        _render_lock.release()


class PdfRenderHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def _send(self, response):
        self.send_response(response.status)
        for key, value in response.headers.items():
            self.send_header(key, value)
        self.send_header('Content-Length', str(len(response.body)))
        self.end_headers()
        self.wfile.write(response.body)

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', ''))
        except ValueError:
            self._send(error_response(411, 'Content-Length is required.'))
            return
        if self.headers.get('Transfer-Encoding') or length <= 0:
            self._send(error_response(400, 'Invalid PDF request framing.'))
            return
        if length > HOSTED_MAX_BYTES:
            self._send(error_response(413, 'The character exceeds the hosted PDF size limit. No rules were omitted.'))
            return
        try:
            self.connection.settimeout(10)
            body = self.rfile.read(length)
        except (OSError, TimeoutError):
            self._send(error_response(400, 'Incomplete PDF renderer request.'))
            return
        if len(body) != length:
            self._send(error_response(400, 'Incomplete PDF renderer request.'))
            return
        self._send(process_request(body, self.headers))

    def do_GET(self):
        self._send(error_response(405, 'Use POST for PDF export.'))

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_GET
