"""Optional RGB print color must preserve text, geometry, alpha and default ink."""
import base64
import hashlib
from io import BytesIO
from pathlib import Path
import re
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from character_pdf.renderer import ASSETS, STYLES, render, validate_request
from character_pdf.test_renderer import character
from character_pdf import theme
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream


def contrast(first, second):
    def luminance(color):
        linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in color]
        return sum(v*w for v, w in zip(linear, (.2126, .7152, .0722)))
    values = sorted([luminance(first), luminance(second)])
    return (values[1]+.05)/(values[0]+.05)


class ColorContractTests(unittest.TestCase):
    def test_color_is_explicit_boolean_and_monochrome_is_default(self):
        self.assertFalse(validate_request({'character': {}})[1]['color'])
        self.assertTrue(validate_request({'character': {}, 'options': {'color': True}})[1]['color'])
        for value in ('false', 1, None, []):
            with self.assertRaisesRegex(ValueError, 'Color must be a boolean'):
                validate_request({'character': {}, 'options': {'color': value}})

    def test_reading_colors_have_strong_contrast(self):
        self.assertGreaterEqual(contrast(theme.INK, (1, 1, 1)), 7)
        for font in ('Body', 'Head', 'Label'):
            self.assertGreaterEqual(contrast(theme.text_rgb(font, .05), theme.fill_gray(.982)), 4.5)
        self.assertGreaterEqual(contrast(theme.text_rgb('Head', 1), theme.fill_gray(.16)), 7)
        for stop in theme.GOLD_TEXT_STOPS:
            self.assertGreaterEqual(contrast(stop, (1, 1, 1)), 4.5)


@unittest.skipUnless((ASSETS/'fonts/Aubrey.ttf').is_file() and (ASSETS/'styles/aegis/frame.png').is_file(),
                     'Durable PDF assets are not installed')
class NativeColorTests(unittest.TestCase):
    def test_all_twelve_metal_frames_keep_source_resolution_and_alpha(self):
        for style, *_ in STYLES:
            for kind, filename in (('original', 'frame.png'), ('bridge', 'bridge.png')):
                with self.subTest(style=style, kind=kind):
                    path = ASSETS/'styles'/style/filename
                    source = Image.open(path).convert('RGBA')
                    colored = theme.colored_frame(str(path), style, kind)
                    self.assertEqual(colored.size, source.size)
                    self.assertEqual(colored.getchannel('A').tobytes(), source.getchannel('A').tobytes())
                    visible = {pixel[:3] for index, pixel in enumerate(colored.getdata())
                               if index % 97 == 0 and pixel[3] > 160}
                    self.assertGreater(len(visible), 75)
                    self.assertTrue(any(r > g*1.08 and g > b*1.15 for r, g, b in visible), 'Gold relief missing')
                    self.assertTrue(any(g > r*1.08 and b > r*1.08 for r, g, b in visible), 'Teal inlay missing')

    def test_native_rgb_preserves_art_and_mono_output_and_geometry(self):
        image = Image.new('RGBA', (512, 256), (230, 40, 80, 210))
        png = BytesIO()
        image.save(png, format='PNG')
        source = character(9)
        source['pdfMedia'] = {'character': {'mimeType': 'image/png', 'data': base64.b64encode(png.getvalue()).decode()}}
        with tempfile.TemporaryDirectory() as directory:
            for orientation in ('portrait', 'landscape'):
                common = {'orientation': orientation, 'style': 'aegis' if orientation == 'portrait' else 'vesper',
                          'density': 'compact', 'workbench': True}
                implicit = render({'character': source, 'options': common}, Path(directory)/(orientation+'-default.pdf'))
                mono = render({'character': source, 'options': dict(common, color=False)}, Path(directory)/(orientation+'-mono.pdf'))
                colored = render({'character': source, 'options': dict(common, color=True)}, Path(directory)/(orientation+'-color.pdf'))
                self.assertEqual(implicit['sha256'], mono['sha256'])
                self.assertEqual(mono['pages'], colored['pages'])
                geometry = lambda manifest: [(v['page'], v['panel'], v['text'], v['box'], v['font'], v['size'])
                                             for v in manifest['text_boxes']]
                self.assertEqual(geometry(mono), geometry(colored))
                self.assertEqual(mono['metric_pairs'], colored['metric_pairs'])
                self.assertEqual(mono['writing_fields'], colored['writing_fields'])
                self.assertTrue(colored['color_theme']['simulated_metal'])
                reader = PdfReader(colored['path'])
                hashes = set()
                for page in reader.pages:
                    for reference in page['/Resources'].get('/XObject', {}).values():
                        obj = reference.get_object()
                        if obj.get('/Subtype') == '/Image':
                            self.assertEqual(obj['/ColorSpace'], '/DeviceRGB')
                            hashes.add(hashlib.sha256(obj.get_data()).hexdigest())
                self.assertIn(hashlib.sha256(image.convert('RGB').tobytes()).hexdigest(), hashes)
                for asset in colored['raster_assets'].values():
                    self.assertIn(asset['embedded_rgb_sha256'], hashes)
                operations = ContentStream(reader.pages[0].get_contents(), reader).operations
                self.assertTrue(any(operator == b'sh' for _, operator in operations), 'Metallic text gradient missing')
                self.assertTrue(any(operator == b'rg' and len(operands) == 3 and
                                    max(abs(float(a)-b) for a, b in zip(operands, theme.INK)) < .000001
                                    for operands, operator in operations), 'Native dark-teal reading text missing')
                mono_reader = PdfReader(mono['path'])
                # Native gradient text can change extraction line-break grouping
                # on a shared header baseline; its text and geometry must match.
                normalize = lambda text: re.sub(r'\s+', ' ', text).strip()
                self.assertEqual(normalize(''.join(p.extract_text() for p in reader.pages)),
                                 normalize(''.join(p.extract_text() for p in mono_reader.pages)))
                for page in mono_reader.pages:
                    for reference in page['/Resources'].get('/XObject', {}).values():
                        obj = reference.get_object()
                        if obj.get('/Subtype') == '/Image':
                            self.assertEqual(obj['/ColorSpace'], '/DeviceGray')


if __name__ == '__main__':
    unittest.main()
