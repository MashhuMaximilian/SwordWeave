"""Signed HTTP boundary tests; no server, database, or real character needed."""
from email.message import Message
from io import BytesIO
from pathlib import Path
from unittest import TestCase, mock
import hashlib
import hmac
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from character_pdf.transport_http import HOSTED_MAX_BYTES, PdfRenderHandler, process_request

SECRET = 'test-only-render-secret-32-characters-long'
NOW = 1_800_000_000
BODY = json.dumps({'character': {'name': 'Private character'}, 'options': {}}).encode()


def headers(body=BODY, *, timestamp=NOW, secret=SECRET):
    stamp = str(timestamp)
    result = Message()
    result['Content-Type'] = 'application/json'
    result['X-SwordWeave-PDF-Timestamp'] = stamp
    result['X-SwordWeave-PDF-Signature'] = hmac.new(secret.encode(), stamp.encode() + b'\n' + body, hashlib.sha256).hexdigest()
    return result


def write_pdf(_request, output):
    output.write_bytes(b'%PDF-1.7\nprivate output')


class HttpBoundaryTests(TestCase):
    def request(self, body=BODY, signed=None, renderer=write_pdf, **kwargs):
        return process_request(body, signed or headers(body), secret=SECRET, now=NOW, render_impl=renderer, **kwargs)

    def test_valid_signature_returns_private_pdf_and_removes_working_files(self):
        paths = []
        def render(request, output):
            self.assertEqual(request['character']['name'], 'Private character')
            paths.append(output)
            write_pdf(request, output)
        response = self.request(renderer=render)
        self.assertEqual(response.status, 200)
        self.assertEqual(response.headers['Content-Type'], 'application/pdf')
        self.assertIn('no-store', response.headers['Cache-Control'])
        self.assertTrue(response.body.startswith(b'%PDF-'))
        self.assertFalse(paths[0].parent.exists())

    def test_missing_or_short_secret_fails_closed(self):
        for secret in ('', 'short'):
            self.assertEqual(process_request(BODY, headers(), secret=secret, now=NOW).status, 503)

    def test_wrong_signature_and_modified_body_do_not_render(self):
        renderer = mock.Mock()
        for body, signed in ((BODY, headers(secret='wrong-secret')), (BODY+b' ', headers())):
            self.assertEqual(self.request(body, signed, renderer).status, 401)
        renderer.assert_not_called()

    def test_stale_and_future_signatures_are_rejected(self):
        for timestamp in (NOW-121, NOW+121):
            self.assertEqual(self.request(signed=headers(timestamp=timestamp)).status, 401)

    def test_malformed_signature_headers_are_rejected(self):
        signed = headers()
        signed.replace_header('X-SwordWeave-PDF-Timestamp', '1e9')
        self.assertEqual(self.request(signed=signed).status, 401)
        signed = headers()
        signed.replace_header('X-SwordWeave-PDF-Signature', 'invalid')
        self.assertEqual(self.request(signed=signed).status, 401)

    def test_size_limit_runs_before_json_or_renderer(self):
        renderer = mock.Mock()
        response = self.request(b'x'*(HOSTED_MAX_BYTES+1), renderer=renderer)
        self.assertEqual(response.status, 413)
        renderer.assert_not_called()

    def test_invalid_content_type_and_envelope(self):
        signed = headers()
        signed.replace_header('Content-Type', 'text/plain')
        self.assertEqual(self.request(signed=signed).status, 415)
        for body in (b'{', b'[]', b'{"character":null,"options":{}}', b'{"character":{},"options":{},"extra":1}'):
            self.assertEqual(self.request(body).status, 400)

    def test_renderer_failures_have_no_private_details_and_release_the_lock(self):
        def fail(_request, _output):
            raise ValueError('SECRET PRIVATE AUTHORED RULE')
        response = self.request(renderer=fail)
        self.assertEqual(response.status, 503)
        self.assertNotIn(b'SECRET', response.body)
        self.assertEqual(self.request().status, 200)

    def test_parallel_render_is_rejected_until_current_render_finishes(self):
        nested = []
        def render(request, output):
            nested.append(self.request())
            write_pdf(request, output)
        self.assertEqual(self.request(renderer=render).status, 200)
        self.assertEqual(nested[0].status, 429)
        self.assertEqual(nested[0].headers['Retry-After'], '2')
        self.assertEqual(self.request().status, 200)

    def test_invalid_and_oversized_outputs_are_not_returned(self):
        for data, status in ((b'not PDF', 503), (b'%PDF-'+b'x'*HOSTED_MAX_BYTES, 413)):
            def render(_request, output):
                output.write_bytes(data)
            response = self.request(renderer=render)
            self.assertEqual(response.status, status)
            self.assertNotEqual(response.body, data)

    def test_handler_checks_content_length_without_reading_oversized_body(self):
        handler = object.__new__(PdfRenderHandler)
        handler.headers = Message()
        handler.headers['Content-Length'] = str(HOSTED_MAX_BYTES+1)
        handler.rfile = mock.Mock()
        handler._send = mock.Mock()
        handler.do_POST()
        self.assertEqual(handler._send.call_args.args[0].status, 413)
        handler.rfile.read.assert_not_called()

    def test_handler_rejects_incomplete_body(self):
        handler = object.__new__(PdfRenderHandler)
        handler.headers = Message()
        handler.headers['Content-Length'] = '10'
        handler.rfile = BytesIO(b'{}')
        handler.connection = mock.Mock()
        handler._send = mock.Mock()
        handler.do_POST()
        self.assertEqual(handler._send.call_args.args[0].status, 400)
