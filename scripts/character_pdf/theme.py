"""Optional SwordWeave print color, without changing approved sheet geometry.

Metal is simulated RGB using the accepted PHB's gold, teal and silver palette.
The monochrome renderer never instantiates this Canvas or recolors an asset.
"""
from functools import lru_cache
from pathlib import Path
import math

from PIL import Image
from reportlab.lib.colors import Color
from reportlab.pdfgen.canvas import Canvas


def rgb(value):
    return tuple(int(value[index:index+2], 16)/255 for index in (1, 3, 5))


INK = rgb('#173331')
TEAL = rgb('#1e706a')
GOLD = rgb('#876323')
MUTED = rgb('#58726b')
IVORY = rgb('#f8f3e7')
SILVER = rgb('#adbcb0')
GOLD_TEXT_STOPS = tuple(rgb(value) for value in ('#61461b', '#8d6826', '#94712c', '#79541d', '#5e4319'))


def fill_gray(gray):
    """Map native design surfaces; writing areas remain white or very pale."""
    if gray >= .999:
        return (1, 1, 1)
    if gray >= .98:
        return rgb('#fffdf8')
    if gray >= .94:
        return rgb('#f6f3e8')
    if gray >= .84:
        return rgb('#e8f0e9')
    if gray >= .55:
        return rgb('#b7c9ba')
    if gray >= .30:
        return rgb('#4b7f74')
    return rgb('#174b48')


def stroke_gray(gray):
    if gray < .28:
        return rgb('#785720')
    if gray < .53:
        return rgb('#a18448')
    if gray < .73:
        return rgb('#9baea0')
    return rgb('#c5d0c4')


def text_rgb(font, gray):
    if gray >= .9:
        return rgb('#fff9e9')
    if gray >= .25:
        return MUTED
    if font in ('Display', 'Label'):
        return GOLD
    if font == 'Head':
        return rgb('#185d56')
    return INK


class ColorCanvas(Canvas):
    """Color every native legacy card/table primitive through its gray roles."""
    def setFillGray(self, gray, alpha=None):
        return super().setFillColorRGB(*fill_gray(gray), alpha=alpha)

    def setStrokeGray(self, gray, alpha=None):
        return super().setStrokeColorRGB(*stroke_gray(gray), alpha=alpha)


def _ramp(stops):
    parsed = [(position, tuple(int(color[index:index+2], 16) for index in (1, 3, 5)))
              for position, color in stops]
    channels = [[], [], []]
    for gray in range(256):
        t = gray/255
        left, right = parsed[0], parsed[-1]
        for first, second in zip(parsed, parsed[1:]):
            if first[0] <= t <= second[0]:
                left, right = first, second
                break
        fraction = (t-left[0])/(right[0]-left[0])
        for channel in range(3):
            channels[channel].append(round(left[1][channel]+fraction*(right[1][channel]-left[1][channel])))
    return channels


GOLD_RAMP = _ramp([(0, '#172d29'), (.2, '#654619'), (.45, '#ab7728'),
                   (.65, '#d3a04c'), (.82, '#f6d58b'), (1, '#fff5d4')])
TEAL_RAMP = _ramp([(0, '#082f35'), (.22, '#105761'), (.48, '#137b83'),
                   (.70, '#47a8aa'), (.86, '#abd7ca'), (1, '#f4f3dc')])
SILVER_RAMP = _ramp([(0, '#16363a'), (.28, '#5c797b'), (.52, '#9eb6b0'),
                     (.74, '#dbe6d6'), (.88, '#b9c8b7'), (1, '#fff8e3')])


def _tint(gray, channels):
    return Image.merge('RGB', tuple(gray.point(channel) for channel in channels))


@lru_cache(maxsize=4)
def colored_frame(path, style, asset_kind):
    """Preserve every source pixel and its alpha; separate three metal tones.

    Spatial inlays vary material across the engraving while original luminance
    carries the complete relief. A 256-color RGB palette keeps native-resolution
    PDF streams compact; it never resamples the image or alters transparency.
    """
    original = Image.open(Path(path)).convert('RGBA')
    gray, alpha = original.convert('L'), original.getchannel('A')
    width, height = original.size
    gold, teal, silver = (_tint(gray, ramp) for ramp in (GOLD_RAMP, TEAL_RAMP, SILVER_RAMP))
    organic = style in ('vesper', 'helix', 'nocturne', 'tidal', 'serein')
    weights = []
    for x in range(width):
        u = x/max(1, width-1)
        if asset_kind == 'original':
            distance = min(u, 1-u)
            inlay = .75*math.exp(-((distance-.055)/.037)**2)+.65*math.exp(-((distance-.145)/.025)**2)
        else:
            inlay = .5+.5*math.cos(u*math.pi*6)
        # Distinct inlays, rather than averaging gold and teal into olive.
        separation = max(0, min(1, (inlay-(.28 if organic else .32))/.20))
        separation = separation*separation*(3-2*separation)
        weights.append(round((.02+.96*separation)*255))
    inlay_mask = Image.frombytes('L', (width, 1), bytes(weights)).resize((width, height))
    polished = Image.composite(silver, gold, gray.point(lambda g: round(max(0, g-155)*.45)))
    metal = Image.composite(teal, polished, inlay_mask)
    # Palette compression is color-only; the original alpha remains byte exact.
    metal = metal.quantize(colors=256, method=Image.Quantize.MEDIANCUT,
                           dither=Image.Dither.NONE).convert('RGB')
    return Image.merge('RGBA', (*metal.split(), alpha))


def color(value):
    return Color(*value)
