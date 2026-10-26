"""One character, one selected front, full rules, repeatable supporting leaves.

Native text and vectors use the app's own fonts. Approved frame geometry and
alpha remain intact in default monochrome and optional simulated-metal RGB.
Landscape has two independently laid out panels and a protected folding gutter.
"""
from collections import deque
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import base64
import hashlib
import json
import math
import re

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from .design import (APPROVED_FOLIO, ROOT, STYLES, GROUPS, AXES, RANGES,
                     DISTANCES, DICE, ACCESS, TIER_LABELS, set_panel_dimensions)
from .markdown import markdown_html, markdown_plain
from . import theme

ASSETS = ROOT / 'assets/character-pdf'
PORTRAIT = (595.276, 841.89)
LANDSCAPE = (841.89, 595.276)
FONT_FILES = {'Body': 'Aubrey', 'Bold': 'BodyBold', 'BodyBold': 'BodyBold',
              'BodyItalic': 'BodyItalic', 'BodyBoldItalic': 'BodyBoldItalic',
              'Label': 'Syne', 'Display': 'UnicaOne', 'Head': 'Oxanium'}
RULE_SIZE = 9.2
RULE_LEADING = 11.2
FOLD_CLEARANCE = 16.
PRACTICE_KEY = 'Practice hex: empty untrained / dot proficient / filled expertise.'


def clean(value):
    if value is None:
        return ''
    return (str(value).replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-')
            .replace('\u2212', '-').replace('\u00a0', ' ').replace('\u2264', '<=')
            .replace('\u2265', '>=').replace('\u2192', '->').replace('\u2190', '<-')
            .replace('\u00d7', 'x').replace('\u00f7', '/'))


def text_body(record):
    for key in ('mechanicalOutputText', 'verboseDescription', 'description',
                'narrativeDescription', 'narrativeRule'):
        if record.get(key):
            return clean(record[key])
    return ''


def number(value, signed=False):
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        value = int(value) if int(value) == value else value
        return f'{value:+}' if signed else str(value)
    return '' if value is None else clean(value)


def unique_text(parts):
    result = []
    for part in parts:
        part = clean(part).strip()
        if part and part not in result:
            result.append(part)
    return '\n'.join(result)


def pinned_version(link, record):
    return link.get('versionId') or record.get('versionId') or record.get('workspaceVersionId')


def pinned_identity(kind, link, record):
    """IDs identify definitions; pins/mirror/effective content identify rules."""
    source_id = record.get('id', link.get(kind+'Id'))
    content = {key: record.get(key) for key in ('name', 'mechanicalOutputText', 'verboseDescription',
               'description', 'narrativeDescription', 'narrativeRule', 'mechanicalRule',
               'modifiers', 'hardModifiers', 'primitiveLinks', 'effectLinks') if record.get(key) is not None}
    # Some public capability links hold membership at link rather than record.
    if link.get('effectLinks'):
        content['linkedEffects'] = link['effectLinks']
    digest = hashlib.sha256(json.dumps(content, sort_keys=True, default=str).encode()).hexdigest()
    return (str(source_id), pinned_version(link, record),
            bool(link.get('isMirrored', record.get('isMirrored', False))), digest)


def matching_primitive_refs(link, rows):
    primitive = link.get('primitive') or {}
    primitive_id = link.get('primitiveId', primitive.get('id'))
    candidates = [row for row in rows if str(row['source_id']) == str(primitive_id)]
    mirrored = bool(link.get('isMirrored', primitive.get('isMirrored', False)))
    candidates = [row for row in candidates if row['is_mirrored'] == mirrored]
    version = pinned_version(link, primitive)
    if version:
        pinned = [row for row in candidates if row['version_id'] == version]
        candidates = pinned or [row for row in candidates if row['version_id'] is None]
    preferred = primitive.get('mechanicalOutputText') or primitive.get('narrativeRule')
    if preferred:
        effective = [row for row in candidates if row['rule'] == clean(preferred)]
        if effective:
            candidates = effective
        elif primitive.get('mechanicalOutputText'):
            candidates = []
    # Multiple real acquisitions of the same matching rule are all valid refs.
    return [row['ref'] for row in candidates]


def primitive_records(character):
    result = []
    for index, link in enumerate(character.get('primitiveLinks') or [], 1):
        primitive = link.get('primitive') or {}
        preferred = primitive.get('mechanicalOutputText') or primitive.get('narrativeRule') or ''
        result.append({'ref': f'P{index:02}', 'name': clean(primitive.get('name') or 'Unnamed primitive'),
                       'rule': clean(preferred), 'rendered_text': markdown_plain(clean(preferred)),
                       'narrative': clean(primitive.get('narrativeRule')),
                       'mechanical': clean(primitive.get('mechanicalOutputText')) if
                           clean(primitive.get('originalMechanicalOutputText', primitive.get('mechanicalOutputText'))).strip() else '',
                       'verbose': unique_text([primitive.get(key) for key in
                           ('verboseDescription', 'narrativeRule', 'description', 'narrativeDescription')]),
                       'category': primitive.get('category') or '', 'source_id': primitive.get('id'),
                       'instance_id': link.get('instanceId'), 'version_id': pinned_version(link, primitive),
                       'is_mirrored': bool(link.get('isMirrored')),
                       'bindings': (primitive.get('mechanicalRule') or {}).get('bindings') or {},
                       'entity_kind': 'primitive',
                       'front_priority': primitive_front_priority(primitive),
                       'preferred': 'mechanical' if primitive.get('mechanicalOutputText') else 'narrative'})
    return result


def primitive_front_priority(primitive):
    """Reading order only: never renumber acquisitions or infer their rules."""
    authored = primitive.get('originalMechanicalOutputText', primitive.get('mechanicalOutputText'))
    if not clean(authored).strip():
        return 0
    modifiers = [m for m in primitive.get('hardModifiers') or [] if isinstance(m, dict)
                 and m.get('operation') not in ('grant', 'revoke')]
    rule = primitive.get('mechanicalRule') or {}
    if not modifiers and rule.get('family') not in ('UNIVERSAL_MODIFIER', 'DAMAGE_MODIFIER'):
        return 1
    conditional = rule.get('conditionText') or rule.get('condition') or any(m.get('condition') for m in modifiers)
    return 2 if conditional else 3


def access_value(record):
    name = record['name']
    category = record['category']
    bindings = record.get('bindings') or {}
    if category == 'VERB_TIER':
        candidate = str(bindings.get('tier') or '')
        match = re.search(r'\b(IV|III|II|I|[1-4])\b', candidate + ' ' + name)
        return {'1': 'I', '2': 'II', '3': 'III', '4': 'IV'}.get(match.group(1), match.group(1)) if match else name
    if category == 'DOMAIN':
        return clean(bindings.get('domain') or name.replace('Domain of ', '')).title()
    if category == 'RANGE':
        for distance in reversed(RANGES):
            if distance.lower() in name.lower():
                return distance
        return name.replace(' Range', '')
    if category == 'INTENSITY_DICE':
        match = re.search(r'd(?:4|6|8|10|12|20)\b', name + ' ' + record['rule'], re.I)
        return match.group(0).lower() if match else name
    return name


def stats(character):
    derived = character.get('pdfDerived') or {}
    context = (character.get('conditionContext') or {}).get('character') or {}
    custom = context.get('custom') or {}
    attributes = derived.get('attributes') or context.get('attributes') or character.get('attributes') or {}
    practices = derived.get('practices') or character.get('practices') or []
    if isinstance(practices, dict):
        practices = [{'practice': key, 'total': value} for key, value in practices.items()]
    pb = derived.get('pb', custom.get('proficiency_bonus', character.get('proficiencyBonus')))
    saves = derived.get('saves') or {key: custom.get(key + '_saving_throw') for key in ('physical', 'mental', 'magical')}
    vitality = character.get('vitality') or {}
    max_vitality = vitality.get('max', context.get('vitalityMax'))
    encumbrance = character.get('encumbrance') or {}
    return {'attributes': attributes, 'practices': practices, 'pb': pb, 'saves': saves,
            'dc': derived.get('dc', context.get('saveDc')),
            'vitality': max_vitality,
            'restCap': derived.get('restCap', math.ceil(max_vitality / 2) if isinstance(max_vitality, (int, float)) else None),
            'movement': derived.get('movement') or character.get('speeds') or {},
            'slotCapacity': derived.get('slotCapacity', encumbrance.get('equipSlotsAvailable')),
            'equippedSlotsUsed': derived.get('equippedSlotsUsed', encumbrance.get('equipSlotsUsed')),
            'currentLoad': derived.get('currentLoad', encumbrance.get('load')),
            'carryCapacity': derived.get('carryCapacity', character.get('carryCapacity', encumbrance.get('capacity')))}


def training_level(row, pb):
    training = row.get('training')
    if isinstance(training, (int, float)):
        return max(0, min(2, int(training)))
    if isinstance(training, str):
        return {'EXPERTISE': 2, 'EXPERT': 2, 'PROFICIENT': 1, 'PROFICIENCY': 1}.get(training.upper(), 0)
    contribution = row.get('pbContribution', 0)
    return max(0, min(2, round(contribution / pb))) if pb else 0


def debt_account(character):
    """Same used/available/max debt calculation as the sheet identity drawer."""
    balance, volatility = character.get('buBalance') or {}, character.get('volatility') or {}
    spent, pool = balance.get('progressionSpent'), balance.get('progressionPool')
    credit, ceiling = volatility.get('rating'), volatility.get('ceiling')
    known = all(isinstance(value, (int, float)) for value in (spent, pool, credit, ceiling))
    used = min(max(0, spent-pool), credit) if known else None
    return {'used': used, 'available': max(0, min(credit, ceiling)-used) if known else None,
            'max': ceiling, 'bracket': volatility.get('levelBracket') or '?'}


def available_bu(character):
    remaining = (character.get('buBalance') or {}).get('progressionRemaining')
    return max(0, remaining) if isinstance(remaining, (int, float)) else None


def supporting_records(character, primitives):
    """Keep source ownership and full authored text; private DM notes never print."""
    groups = {'capabilities': [], 'effects': [], 'items': [], 'identity': [], 'full_rules': []}
    groups['identity'].append({'ref': '', 'name': 'Character / concept',
                               'body': unique_text([character.get('name'), character.get('concept')]),
                               'entity_kind': 'character', 'source_id': character.get('id')})
    graph = character.get('readOnlyGraph') or {}
    nodes = graph.get('nodes') or []
    graph_lookup = {(n.get('kind'), str(n.get('id'))): n for n in nodes}
    effects = []
    seen_effects = set()
    item_primitives_by_ref = []
    caps = []
    cap_owners = {}

    def add_cap(link, owner):
        cap = link.get('capability') or {}
        cid = str(cap.get('id') or link.get('capabilityId') or cap.get('name'))
        if not cap.get('name'):
            node = graph_lookup.get(('capability', cid), {})
            cap = dict(node.get('data') or {}, name=node.get('name') or 'Unnamed capability')
        identity = pinned_identity('capability', link, cap)
        if identity not in cap_owners:
            cap_owners[identity] = []
            caps.append((identity, cap, link))
        if owner not in cap_owners[identity]:
            cap_owners[identity].append(owner)
        for effect_link in (link.get('effectLinks') or []) + (cap.get('effectLinks') or []):
            add_effect(effect_link.get('effect') or {}, effect_link)

    def add_effect(effect, link=None):
        link = link or {}
        eid = str(effect.get('id') or link.get('effectId') or effect.get('name'))
        if not effect.get('name'):
            node = graph_lookup.get(('effect', eid), {})
            effect = dict(node.get('data') or {}, name=node.get('name') or 'Unnamed effect',
                          description=node.get('description') or '')
        identity = pinned_identity('effect', link, effect)
        if identity in seen_effects:
            return
        seen_effects.add(identity)
        effects.append((identity, effect, link))
        for child in (effect.get('effectLinks') or []) + (link.get('effectLinks') or []):
            add_effect(child.get('effect') or {}, child)

    for link in character.get('capabilityLinks') or []:
        add_cap(link, 'Character')
    for link in character.get('effectLinks') or []:
        add_effect(link.get('effect') or {}, link)
    for index, link in enumerate(character.get('itemLinks') or [], 1):
        item = link.get('item') or {}
        ref = f'I{index:02}'
        name = clean(item.get('name') or 'Unnamed item')
        for cap in item.get('capabilityLinks') or []:
            add_cap(cap, ref + ' / ' + name)
        for effect in item.get('effectLinks') or []:
            add_effect(effect.get('effect') or {}, effect)
        quantity = link.get('quantity', 1)
        load_each = {'TINY': 1, 'SMALL': 1, 'MEDIUM': 2, 'LARGE': 4, 'HUGE': 8, 'GARGANTUAN': 16}.get(item.get('size'))
        load = link.get('load', load_each * quantity if load_each is not None else None)
        slots = link.get('equippedSlotCost', item.get('slotCost') if link.get('equipped') else 0)
        bu = item.get('buCost')
        parts = [f"Quantity {quantity}; Load {number(load) or '?'}; equipped slots {number(slots) or '?'}; Item BU {number(bu * quantity) if isinstance(bu, (int, float)) else '?'}; {'equipped' if link.get('equipped') else 'carried'}.", text_body(item)]
        item_primitives = item.get('primitiveLinks') or []
        # Graph edges can carry pinned item primitives absent from a shallow link.
        if not item_primitives:
            for edge in graph.get('edges') or []:
                parent, child = edge.get('parent', edge.get('from')), edge.get('child', edge.get('to', ''))
                if parent == 'item:' + str(item.get('id')) and str(child).startswith('primitive:'):
                    node = graph_lookup.get(('primitive', child.split(':', 1)[1]), {})
                    data = dict(node.get('data') or {}, name=node.get('name'), narrativeRule=node.get('description'))
                    effective = (edge.get('data') or {}).get('pdfMechanicalOutputText')
                    if effective:
                        data['mechanicalOutputText'] = effective
                    item_primitives.append({'primitive': data, 'isMirrored': edge.get('isMirrored')})
        for pindex, primitive_link in enumerate(item_primitives, 1):
            primitive = primitive_link.get('primitive') or {}
            parts.append(f"{ref}.P{pindex:02} / {clean(primitive.get('name'))}: " + unique_text([primitive.get('mechanicalOutputText'), primitive.get('narrativeRule')]))
        for primitive in primitive_records({'primitiveLinks': item_primitives}):
            item_primitives_by_ref.append(dict(primitive, ref=ref+'.'+primitive['ref']))
        groups['items'].append({'ref': ref, 'name': name, 'body': unique_text(parts), 'quantity': quantity,
                                'load': load, 'slots': slots, 'item_bu': bu * quantity if isinstance(bu, (int, float)) else None,
                                'equipped': bool(link.get('equipped')), 'entity_kind': 'item',
                                'source_id': str(item.get('id')), 'version_id': pinned_version(link, item)})
    for node in nodes:
        if node.get('kind') == 'effect':
            effect = dict(node.get('data') or {}, id=node.get('id'), name=node.get('name'), description=node.get('description'))
            # Equivalent graph fallback views need no second printed rule;
            # conflicting pinned text remains a separate E reference.
            equivalent = any(key[0] == str(node.get('id')) and
                             (not node.get('versionId') or key[1] == node.get('versionId')) and
                             text_body(existing) == text_body(effect)
                             for key, existing, _ in effects)
            if not equivalent:
                add_effect(effect, {'effectId': node.get('id'), 'versionId': node.get('versionId')})
    effect_refs = {identity: f'E{index:02}' for index, (identity, _, _) in enumerate(effects, 1)}
    # Item acquisitions keep their Ixx.Pxx namespace; a reference does not
    # convert an item rule into another character purchase.
    reference_primitives = primitives + item_primitives_by_ref

    def matching_effect_refs(effect_link):
        effect = effect_link.get('effect') or {}
        eid = str(effect.get('id') or effect_link.get('effectId'))
        exact = effect_refs.get(pinned_identity('effect', effect_link, effect))
        if exact:
            return [exact]
        version = pinned_version(effect_link, effect)
        mirrored = bool(effect_link.get('isMirrored', effect.get('isMirrored', False)))
        candidates = [identity for identity, _, _ in effects if identity[0] == eid and identity[2] == mirrored]
        if version:
            pinned = [identity for identity in candidates if identity[1] == version]
            candidates = pinned or [identity for identity in candidates if identity[1] is None]
        return [effect_refs[identity] for identity in candidates]

    for index, (identity, cap, link) in enumerate(caps, 1):
        ref = f'C{index:02}'
        refs = []
        for p in cap.get('primitiveLinks') or []:
            refs.extend(matching_primitive_refs(p, reference_primitives))
        for e in (cap.get('effectLinks') or []) + (link.get('effectLinks') or []):
            refs.extend(matching_effect_refs(e))
        parts = ['Source: ' + ' + '.join(cap_owners[identity]) + '.',
                 ('Owned references: ' + ', '.join(dict.fromkeys(refs)) + '.') if refs else '',
                 unique_text([cap.get('mechanicalOutputText'), cap.get('verboseDescription'), cap.get('narrativeDescription'), cap.get('description')])]
        groups['capabilities'].append({'ref': ref, 'name': clean(cap.get('name')), 'body': unique_text(parts),
                                       'source_id': identity[0], 'version_id': identity[1], 'is_mirrored': identity[2],
                                       'entity_kind': 'capability'})
    for index, (identity, effect, link) in enumerate(effects, 1):
        refs = []
        for primitive in (effect.get('primitiveLinks') or []) + (link.get('primitiveLinks') or []):
            refs.extend(matching_primitive_refs(primitive, reference_primitives))
        for child in (effect.get('effectLinks') or []) + (link.get('effectLinks') or []):
            refs.extend(ref for ref in matching_effect_refs(child) if ref != f'E{index:02}')
        groups['effects'].append({'ref': f'E{index:02}', 'name': clean(effect.get('name')), 'body': unique_text([
                                  ('Owned references: ' + ', '.join(dict.fromkeys(refs)) + '.') if refs else '',
                                  effect.get('mechanicalOutputText'), effect.get('description'), effect.get('narrativeDescription')]),
                                  'source_id': identity[0], 'version_id': identity[1], 'is_mirrored': identity[2],
                                  'entity_kind': 'effect'})
    for row in reference_primitives:
        # Every acquisition gets a complete source entry, including those
        # already printed on the front. Keep pins, repeated purchases and
        # mirrored effective rules distinct; prose never overwrites mechanics.
        note = ('Original authored narrative; this acquisition is mirrored. The effective mechanical rule above governs.'
                if row['is_mirrored'] and row['verbose'] else '')
        owner = row['ref'].split('.')[0] if row['ref'].startswith('I') else None
        sections = [('note', '', f'Item-bound rule / {owner}. Applies through this item.' if owner else ''),
                    ('mechanical', 'Mechanical', row['mechanical']),
                    ('note', '', note), ('narrative', 'Narrative / verbose', row['verbose'])]
        sections = [{'kind': kind, 'label': label, 'text': text} for kind, label, text in sections if text]
        body = unique_text([(section['label']+'\n' if section['label'] else '')+section['text'] for section in sections])
        groups['full_rules'].append({'ref': row['ref'], 'name': row['name'], 'body': body,
                                     'sections': sections, 'entity_kind': 'primitive',
                                     'source_id': row['source_id'], 'version_id': row['version_id'],
                                     'is_mirrored': row['is_mirrored']})
    for index, link in enumerate(character.get('heritageLinks') or [], 1):
        heritage = link.get('heritage') or {}
        kind = clean(heritage.get('kind') or 'Heritage').replace('_', ' ').title()
        groups['identity'].append({'ref': f'H{index:02}', 'name': kind + ' / ' + clean(heritage.get('name')), 'body': text_body(heritage),
                                   'entity_kind': 'heritage', 'source_id': str(heritage.get('id')),
                                   'version_id': pinned_version(link, heritage)})
    backstory = character.get('backstory') or {}
    if isinstance(backstory, str):
        backstory = {'Backstory': backstory}
    for key, body in backstory.items():
        if body:
            groups['identity'].append({'ref': '', 'name': clean(key).replace('_', ' ').title(), 'body': clean(body)})
    if character.get('notes'):
        groups['identity'].append({'ref': '', 'name': 'Player notes', 'body': clean(character['notes'])})
    balance = character.get('buBalance') or {}
    debt = debt_account(character)
    account = unique_text([f"Level / Budget {number(character.get('level')) or '?'} / {number(balance.get('progressionPool')) or '?'} BU.",
                           f"Character BU spent {number(balance.get('progressionSpent')) or '?'}; {number(available_bu(character)) or '?'} available. Separate Item BU {number(balance.get('itemBuSpent')) or '?'}.",
                           f"Debt BU: {number(debt['used'])} used / {number(debt['available'])} available / {number(debt['max'])} max ({debt['bracket']}).",
                           f"Agreed bonus BU: {number(balance.get('dmBonusBu'))}." if balance.get('dmBonusBu') is not None else '',
                           'Reusing owned references is not another acquisition. Record agreed changes and their source.'])
    groups['identity'].append({'ref': '', 'name': 'Build account / advancement', 'body': account})
    roll_markers = ((character.get('pdfDerived') or {}).get('rollMarkers') or {}).values()
    if any(state.get('netAdvantage') or state.get('conditional') or state.get('floor') is not None or
           state.get('ceiling') is not None for state in roll_markers):
        groups['identity'].append({'ref': '', 'name': 'Roll symbols', 'body':
            'Double up/down arrows: advantage/disadvantage (a number shows net stacks). '
            'Barred up/down arrows: minimum/maximum result. *: conditional. '
            'These annotate the roll; they do not add to the printed modifier.'})
    for records in groups.values():
        for record in records:
            record['rendered_text'] = markdown_plain(record.get('body', ''))
    return groups


def register_fonts():
    mapping = {}
    for alias, family in FONT_FILES.items():
        path = ASSETS / 'fonts' / (family + '.ttf')
        if not path.is_file():
            raise ValueError(f'Missing application PDF font: {path.name}')
        pdfmetrics.registerFont(TTFont(alias, str(path)))
        mapping[alias] = {'family': family, 'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='BodyItalic', boldItalic='BodyBoldItalic')
    return mapping


class RuntimeFolio(APPROVED_FOLIO):
    """v11 frame and native interior grammar, populated only from this snapshot."""

    def __init__(self, character, options, output):
        self.character, self.options = character, options
        self.color_edition = bool(options.get('color', False))
        self.style = next(style for style in STYLES if style[0] == options['style'])
        self.key, self.name, self.arch, self.brief = self.style
        self.number = str(STYLES.index(self.style) + 1).zfill(2)
        self.path = output
        self.landscape = options['orientation'] == 'landscape'
        self.page_size = LANDSCAPE if self.landscape else PORTRAIT
        # Bring the halves 12 pt closer while retaining a clear, centered fold.
        self.width = (self.page_size[0]-FOLD_CLEARANCE)/2+14 if self.landscape else self.page_size[0]
        self.height = self.page_size[1]
        self.left, self.right = 36., self.width - 36.
        self.gap = 10. if self.landscape else 15.
        set_panel_dimensions(self.width, self.height, self.left)
        self.font_mapping = register_fonts()
        self.stream = BytesIO()
        canvas_type = theme.ColorCanvas if self.color_edition else canvas.Canvas
        self.c = canvas_type(self.stream, pagesize=self.page_size, pageCompression=1, invariant=1, initialFontName='Body')
        self.page = 0
        self.panel = 0
        self.panel_open = False
        self.origin_x = 0
        for name in ('roles', 'texts', 'writing', 'marks', 'placed', 'art', 'choices', 'numeric',
                     'frame_paths', 'source_blocks', 'padding_cards', 'overflow', 'furniture',
                     'panels', 'tables', 'joins', 'beams', 'segments', 'metric_pairs'):
            setattr(self, name, [])
        self.assets = {}
        for asset_key, filename in (('original', 'frame.png'), ('bridge', 'bridge.png')):
            path = ASSETS / 'styles' / self.key / filename
            if not path.is_file():
                raise ValueError(f'Missing approved {self.key} {filename}')
            image = Image.open(path).convert('RGBA')
            embedded = theme.colored_frame(str(path), self.key, asset_key) if self.color_edition else Image.merge('LA', (image.convert('L'), image.getchannel('A')))
            self.assets[asset_key] = {'path': path, 'size': image.size,
                                     'image': ImageReader(embedded),
                                     'color_space': 'DeviceRGB' if self.color_edition else 'DeviceGray',
                                     'embedded_rgb_sha256': hashlib.sha256(embedded.convert('RGB').tobytes()).hexdigest() if self.color_edition else None,
                                     'embedded_gray_sha256': hashlib.sha256(image.convert('L').tobytes()).hexdigest(),
                                     'embedded_alpha_sha256': hashlib.sha256(image.getchannel('A').tobytes()).hexdigest()}
        self.master = self.assets['original']['path']
        self.art_image = self.assets['original']['image']
        self.iw, self.ih = self.assets['original']['size']
        self.stats = stats(character)
        self.rows = primitive_records(character)
        self.groups = supporting_records(character, self.rows)
        self.front_rows = sorted((row for row in self.rows if row['category'] not in ACCESS),
                                 key=lambda row: row['front_priority'])
        self.density_measurements = {}
        self.media_map = character.get('pdfMedia') or {}
        self.media_cache, self.media_placements, self.media_credits = {}, [], set()
        self.media_failures = 0
        self.roll_annotations = []

    def absolute_box(self, box):
        x, y, X, Y = box
        return [x + self.origin_x, y, X + self.origin_x, Y]

    def media(self, record=None, portrait=False):
        """Decode only backend-sanitized PNG bytes; never open a path or URL."""
        if record is not None and not record.get('entity_kind'):
            return None
        kind = (record or {}).get('entity_kind', 'character')
        source_id = str((record or {}).get('source_id', self.character.get('id')))
        version = (record or {}).get('version_id')
        key = kind+':'+source_id
        if kind == 'character':
            payload = self.media_map.get('character')
        elif portrait and kind == 'heritage':
            mapping = self.media_map.get('heritages') or {}
            payload = mapping.get(key+':'+str(version)) if version else None
            payload = payload or mapping.get(source_id) or mapping.get(key)
        else:
            mapping = self.media_map.get('icons') or {}
            payload = mapping.get(key+':'+str(version)) if version else None
            payload = payload or mapping.get(key)
        if not isinstance(payload, dict) or payload.get('mimeType') != 'image/png':
            return None
        encoded = payload.get('data')
        if not isinstance(encoded, str) or len(encoded) > 12_000_000:
            return None
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        cache_key = (key, version, digest)
        if cache_key in self.media_cache:
            return self.media_cache[cache_key]
        result = None
        try:
            data = base64.b64decode(encoded, validate=True)
            if data[:8] != b'\x89PNG\r\n\x1a\n' or len(data) > 8_000_000:
                raise ValueError('Expected a bounded PNG')
            image = Image.open(BytesIO(data))
            if image.format != 'PNG' or image.width*image.height > 16_777_216:
                raise ValueError('Expected bounded image dimensions')
            rgba = image.convert('RGBA')
            gray, alpha = rgba.convert('L'), rgba.getchannel('A')
            embedded = rgba if self.color_edition else Image.merge('LA', (gray, alpha))
            result = {'reader': ImageReader(embedded),
                      'size': image.size, 'sha256': hashlib.sha256(data).hexdigest(),
                      'color_space': 'DeviceRGB' if self.color_edition else 'DeviceGray',
                      'rgb_sha256': hashlib.sha256(rgba.convert('RGB').tobytes()).hexdigest() if self.color_edition else None,
                      'gray_sha256': hashlib.sha256(gray.tobytes()).hexdigest(),
                      'alpha_sha256': hashlib.sha256(alpha.tobytes()).hexdigest(),
                      'key': key+(':'+str(version) if version else ''),
                      'credit': clean(payload.get('credit') or '')}
            if not result['credit'] and payload.get('author'):
                result['credit'] = ' / '.join(clean(payload.get(field)) for field in
                                               ('author', 'source', 'license', 'licenseUrl') if payload.get(field))
        except (ValueError, OSError, Image.DecompressionBombError):
            self.media_failures += 1
        self.media_cache[cache_key] = result
        return result

    def paint_media(self, media, x, y, width, height, role, framed=False, crop_frame=None):
        if not media:
            return
        if framed:
            self.molding(x, y, width, height, 1)
        inset = 2 if framed else 0
        available_width, available_height = width-2*inset, height-2*inset
        native_width, native_height = media['size']
        normalized_frame = None
        if crop_frame is not None:
            raw = crop_frame if isinstance(crop_frame, dict) else {}
            def frame_number(key, fallback, lower, upper):
                value = raw.get(key)
                return max(lower, min(upper, value)) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else fallback
            normalized_frame = {'x': frame_number('x', 50, 0, 100), 'y': frame_number('y', 50, 0, 100),
                                'zoom': frame_number('zoom', 1, .5, 3)}
            scale = max(available_width/native_width, available_height/native_height)*normalized_frame['zoom']
        else:
            scale = min(available_width/native_width, available_height/native_height)
        draw_width, draw_height = native_width*scale, native_height*scale
        if normalized_frame:
            draw_x = x+inset+(available_width-draw_width)*normalized_frame['x']/100
            draw_y = y+inset+(available_height-draw_height)*normalized_frame['y']/100
        else:
            draw_x, draw_y = x+(width-draw_width)/2, y+(height-draw_height)/2
        self.c.saveState()
        clip = None
        if framed:
            path = self.c.beginPath()
            if self.key in ('vesper', 'helix', 'tidal', 'nocturne', 'serein'):
                radius = 5 if self.key in ('helix', 'tidal') else 9
                path.roundRect(x+inset, self.height-y-height+inset,
                               available_width, available_height, radius)
                clip = {'kind': 'rounded', 'radius': radius,
                        'box': self.absolute_box([x+inset, y+inset, x+width-inset, y+height-inset])}
            else:
                cut = {'aegis': 12, 'orrery': 4, 'moire': 7, 'prism': 8,
                       'cipher': 3, 'cinder': 5, 'solstice': 7}[self.key]
                points = [(x+inset+cut, y+inset), (x+width-inset-cut, y+inset),
                          (x+width-inset, y+inset+cut), (x+width-inset, y+height-inset-cut),
                          (x+width-inset-cut, y+height-inset), (x+inset+cut, y+height-inset),
                          (x+inset, y+height-inset-cut), (x+inset, y+inset+cut)]
                path.moveTo(points[0][0], self.height-points[0][1])
                for px, py in points[1:]:
                    path.lineTo(px, self.height-py)
                path.close()
                clip = {'kind': 'polygon', 'points': [[px+self.origin_x, py] for px, py in points]}
            self.c.clipPath(path, stroke=0, fill=0)
        self.c.drawImage(media['reader'], draw_x, self.height-draw_y-draw_height,
                         draw_width, draw_height, mask='auto')
        self.c.restoreState()
        self.media_placements.append({'page': self.page, 'panel': self.panel, 'role': role,
                                      'key': media['key'], 'box': self.absolute_box([x, y, x+width, y+height]),
                                      'draw_box': self.absolute_box([draw_x, draw_y, draw_x+draw_width, draw_y+draw_height]),
                                      'native_size': list(media['size']),
                                      'portrait_frame': normalized_frame,
                                      'clip': clip,
                                      'source_ppi': [native_width/draw_width*72, native_height/draw_height*72],
                                      'color_space': media['color_space'], 'rgb_sha256': media['rgb_sha256'],
                                      'sha256': media['sha256'], 'gray_sha256': media['gray_sha256'],
                                      'alpha_sha256': media['alpha_sha256']})
        if media['credit']:
            self.media_credits.add(media['credit'])

    def text(self, value, x, y, size=8, font='Label', g=.05, align='left'):
        value = clean(value)
        if not value:
            return
        width = pdfmetrics.stringWidth(value, font, size)
        xx = x - (width / 2 if align == 'center' else width if align == 'right' else 0)
        self.c.saveState()
        metallic = self.color_edition and font == 'Display' and size >= 14 and g < .25
        if self.color_edition:
            self.c.setFillColorRGB(*theme.text_rgb(font, g))
        else:
            self.c.setFillGray(g)
        self.c.setFont(font, size)
        baseline = self.height-y-size*.8
        if metallic:
            text = self.c.beginText(xx, baseline)
            text.setFont(font, size)
            text.setTextRenderMode(7)
            text.textOut(value)
            self.c.drawText(text)
            self.c.linearGradient(xx, baseline-size*.25, xx+max(1, width), baseline+size*.75,
                                  [theme.color(stop) for stop in theme.GOLD_TEXT_STOPS],
                                  positions=[0, .25, .5, .75, 1])
        else:
            self.c.drawString(xx, baseline, value)
        self.c.restoreState()
        self.texts.append({'page': self.page, 'panel': self.panel, 'text': value,
                           'box': self.absolute_box([xx, y, xx + width, y + size]), 'font': font, 'size': size})
        if self.color_edition:
            self.texts[-1]['color_rgb'] = theme.text_rgb(font, g)
            self.texts[-1]['metallic'] = metallic

    def value(self, value, x, y, size, role):
        self.text(value, x, y, size, 'Head', align='center')
        self.numeric.append({'page': self.page, 'panel': self.panel, 'role': role,
                             'value': str(value), 'box': self.texts[-1]['box']})

    def paired_metric(self, label, x, y, label_width, value, size, role, card,
                      label_size=8.5, label_font='Body', cell_width=26.):
        """Keep a metric beside its label, inside a centered, measured cell.

        Label columns are measured separately for each practice column. This
        leaves a modest gap even for short labels instead of pushing every
        number against the outer card edge. The cell reserves signed three-
        digit width, so changing the value cannot spill over the next column.
        """
        self.text(label, x, y, label_size, label_font)
        label_box = self.texts[-1]['box']
        gap = 4.
        cell_width = max(cell_width, pdfmetrics.stringWidth(str(value), 'Head', size)+4)
        cell_x = x+label_width+gap
        value_y = y+(label_size-size)*.8  # Shared baseline with the label.
        self.value(value, cell_x+cell_width/2, value_y, size, role)
        self.metric_pairs.append({'page': self.page, 'panel': self.panel, 'role': role,
                                  'label': label, 'label_box': label_box,
                                  'value_box': self.texts[-1]['box'],
                                  'cell': self.absolute_box([cell_x, value_y-1,
                                                             cell_x+cell_width, value_y+size+1]),
                                  'card': self.absolute_box(card)})

    def paragraph_object(self, html, size=RULE_SIZE, leading=RULE_LEADING, first_line_indent=0):
        return Paragraph(html, ParagraphStyle('character-rule', fontName='Body', fontSize=size,
                         leading=leading, textColor=theme.color(theme.INK) if self.color_edition else Color(0, 0, 0), splitLongWords=True,
                         firstLineIndent=first_line_indent,
                         allowWidows=1, allowOrphans=1, spaceAfter=0, spaceBefore=0))

    def paragraph(self, html, x, y, width, size=RULE_SIZE, lead=RULE_LEADING, draw=True):
        paragraph = self.paragraph_object(html, size, lead)
        _, height = paragraph.wrap(width, 100000)
        if draw:
            paragraph.drawOn(self.c, x, self.height - y - height)
            self.texts.append({'page': self.page, 'panel': self.panel, 'text': paragraph.getPlainText(),
                               'rendered_text': paragraph.getPlainText(),
                               'box': self.absolute_box([x, y, x + width, y + height]),
                               'font': 'Body', 'size': size, 'paragraph': True})
        return height

    def plain(self, text, x, y, width, size=RULE_SIZE, lead=RULE_LEADING, draw=True):
        return self.paragraph(escape(clean(text)).replace('\n', '<br/>'), x, y, width, size, lead, draw)

    def write(self, x, y, width, height, role):
        self.writing.append({'page': self.page, 'panel': self.panel, 'role': role,
                             'box': self.absolute_box([x, y, x + width, y + height])})
        # Preserve style-specific terminals from v10 without duplicating records.
        before = len(self.writing)
        super().write(x, y, width, height, role)
        del self.writing[before:]

    def practice_mark(self, x, y, practice, training=0):
        super().practice_mark(x, y, practice, training)
        self.marks[-1]['panel'] = self.panel
        self.marks[-1]['box'] = self.absolute_box(self.marks[-1]['box'])

    def check(self, x, y, label, family, checked=False, size=8.3, secondary=None, meaning='owned'):
        result = super().check(x, y, label, family, checked, size, secondary, meaning)
        self.choices[-1]['panel'] = self.panel
        self.choices[-1]['box'] = self.absolute_box(self.choices[-1]['box'])
        return result

    def begin(self, role, subtitle, character=None):
        if self.panel_open:
            raise RuntimeError('A new panel began before its predecessor ended')
        if not self.landscape or self.panel == 0:
            self.page += 1
        self.origin_x = (self.page_size[0]-self.width) * self.panel if self.landscape else 0
        self.c.saveState()
        self.c.translate(self.origin_x, 0)
        self.panel_open = True
        self.roles.append({'page': self.page, 'panel': self.panel, 'role': role,
                           'character': self.character.get('name'),
                           'box': self.absolute_box([self.left, 80, self.right, self.height - 35])})
        before = {key: len(getattr(self, key)) for key in ('art', 'joins', 'beams', 'frame_paths')}
        self.full_frame()
        for item in self.art[before['art']:]:
            item['panel'] = self.panel
            item['global_box'] = [item['box'][0] + self.origin_x, item['box'][1], item['box'][2], item['box'][3]]
        for key in ('joins', 'beams', 'frame_paths'):
            for item in getattr(self, key)[before[key]:]:
                item['panel'] = self.panel
                if 'points' in item:
                    item['global_points'] = [[x+self.origin_x, y] for x, y in item['points']]
                if 'rail_box' in item:
                    item['global_box'] = self.absolute_box(item['rail_box'])
                elif 'box' in item:
                    item['global_box'] = self.absolute_box(item['box'])
        if self.landscape:
            self.text('S W O R D W E A V E', self.left + 5, 68, 8.1, 'Label')
            label = self.name.upper() + ' / ' + str(self.page).zfill(2) + ('A' if self.panel == 0 else 'B')
            if role.startswith('front'):
                label += ' / ' + ('DENSE' if getattr(self, 'front_density', self.options['density']) == 'compact' else 'NORMAL')
            self.text(label, self.right - 5, 68, 6.7, 'Head', align='right')
        else:
            self.text('S W O R D W E A V E', self.left + 20, 68, 8.5, 'Label')
            self.text('v0.1 ALPHA', 164, 70, 5.2, 'Label', g=.3)
            label = self.name.upper() + ' / ' + str(self.page).zfill(2)
            if role == 'front':
                label += ' / ' + subtitle.split(' / ')[0]
            self.text(label, self.right - 20, 68, 7.5, 'Head', align='right')
        anchor = f'page-{self.page}-panel-{self.panel}'
        self.c.bookmarkPage(anchor)
        self.c.addOutlineEntry(subtitle, anchor, 0, False)

    def end(self):
        self.c.restoreState()
        self.panel_open = False
        if self.landscape and self.panel == 0:
            self.panel = 1
        else:
            self.c.showPage()
            self.panel = 0
            self.origin_x = 0

    def fit_text(self, text, x, y, width, size=9., font='Body', min_size=None):
        """Wrap identity labels; sustained rules never use a shrinking fit."""
        return self.plain(text, x, y, width, size, size * 1.15)

    def identity(self, c=None):
        character = self.character
        portrait = self.media(portrait=True)
        name_left = self.left+(48 if portrait else 0)
        if portrait:
            self.paint_media(portrait, self.left, 80, 40, 40, 'character_portrait', True,
                             self.character.get('portraitFrame') or {})
        name = clean(character.get('name') or 'Unnamed character')
        self.text(self.one_line(name, 373-name_left, 'Display', 17), name_left, 82, 17, 'Display')
        budget = character.get('buBalance') or {}
        self.text('LEVEL / BU', 388, 79, 6.1, 'Head')
        value = f"{number(character.get('level')) or '?'} / {number(budget.get('progressionSpent')) or '?'} of {number(budget.get('progressionPool')) or '?'} BU"
        self.plain(value, 388, 90, self.right-388, 8, 9.2)
        self.text(f"Available {number(available_bu(character)) or '?'}  /  Item BU {number(budget.get('itemBuSpent')) or '?'}", 388, 102, 7.2, 'Body')
        self.text(self.debt_text(), 388, 113, 6.6, 'Body')
        heritages = ' / '.join(clean((link.get('heritage') or {}).get('name')) for link in character.get('heritageLinks') or [])
        concept = character.get('concept') or heritages
        self.text('CONCEPT / HERITAGES', name_left, 109, 6.1, 'Head')
        # The complete identity follows; a long concept is wrapped there, not clipped.
        concept_left = name_left+114
        first_line = self.one_line(concept, 373-concept_left, 'Body', 9.1)
        self.text(first_line, concept_left, 108, 9.1, 'Body')

    def debt_text(self):
        debt = debt_account(self.character)
        return f"Debt {number(debt['used']) or '?'} used / {number(debt['available']) or '?'} available / {number(debt['max']) or '?'} max"

    def domain_text(self, value, x, y, width, size):
        # A native, prominent label without surrounding it in another card.
        self.c.saveState()
        self.c.setFillColorRGB(*(theme.TEAL if self.color_edition else (0, 0, 0)))
        self.c.setFont('BodyBold', size)
        value = self.one_line(value or 'None recorded', width, 'BodyBold', size)
        self.c.drawString(x, self.height-y-size*.8, value)
        self.c.restoreState()
        self.texts.append({'page': self.page, 'panel': self.panel, 'text': value,
                          'box': self.absolute_box([x, y, x+pdfmetrics.stringWidth(value, 'BodyBold', size), y+size]),
                          'font': 'BodyBold', 'size': size, 'role': 'domains'})

    def axis_marks(self, target, x, y, width, size=6.3):
        state = ((self.character.get('pdfDerived') or {}).get('rollMarkers') or {}).get(target) or {}
        net = state.get('netAdvantage', 0)
        marks = []
        if net:
            marks.append(('advantage' if net > 0 else 'disadvantage', str(abs(net)) if abs(net) > 1 else '',
                          '#059669' if net > 0 else '#dc2626'))
        for key in ('floor', 'ceiling'):
            if state.get(key) is not None:
                marks.append((key, number(state[key]), '#d97706'))
        if state.get('conditional'):
            marks.append(('conditional', '*', '#d97706'))
        if not marks:
            return
        required = sum((0 if kind == 'conditional' else 6)+pdfmetrics.stringWidth(value, 'Head', size)+3
                       for kind, value, _ in marks)
        # Callers reserve a separate annotation row when inline space is tight.
        if required > width+.01:
            raise ValueError(f'Roll annotations for {target} exceed their reserved writing measure')
        for kind, value, color in marks:
            start = x
            self.c.saveState()
            rgb = theme.rgb(color) if self.color_edition else (0, 0, 0)
            self.c.setStrokeColorRGB(*rgb)
            self.c.setFillColorRGB(*rgb)
            self.c.setLineWidth(.7)
            if kind != 'conditional':
                up = kind in ('advantage', 'floor')
                tip, tail = (y+1, y+6) if up else (y+6, y+1)
                shafts = (x+1.5, x+4) if kind in ('advantage', 'disadvantage') else (x+3,)
                for shaft in shafts:
                    self.c.line(shaft, self.height-tip, shaft, self.height-tail)
                    end = tip+(2 if up else -2)
                    self.c.line(shaft, self.height-tip, shaft-1.5, self.height-end)
                    self.c.line(shaft, self.height-tip, shaft+1.5, self.height-end)
                if kind in ('floor', 'ceiling'):
                    bar = tip-1 if up else tip+1
                    self.c.line(x, self.height-bar, x+6, self.height-bar)
                x += 6
            self.c.setFont('Head', size)
            self.c.drawString(x, self.height-y-size*.8, value)
            x += pdfmetrics.stringWidth(value, 'Head', size)+3
            self.c.restoreState()
            self.roll_annotations.append({'page': self.page, 'panel': self.panel, 'target': target,
                                          'kind': kind, 'value': value, 'color': list(rgb),
                                          'box': self.absolute_box([start, y-1, x, y+size+1])})

    def metric_marks(self, target, x, y, right, fallback_x=None, fallback_right=None):
        """Use a short second line for dense cards rather than crowding values."""
        if fallback_x is not None:
            self.axis_marks(target, fallback_x, y+9, fallback_right-fallback_x, 5.9)
        else:
            self.axis_marks(target, x, y, max(0, right-x))

    def band_hint(self, title, x, y, width, hint):
        """Give a legend its own measured space beside the structural heading."""
        label_width = pdfmetrics.stringWidth(title, 'Head', 7.2)+44
        size = 6.3
        if label_width+8+pdfmetrics.stringWidth(hint, 'Body', size) <= width:
            self.band(title, x, y, label_width, True)
            self.text(hint, x+label_width+8, y+5, size, 'Body', g=.3)
            return True
        self.band(title, x, y, width, True)
        return False

    def pencil_value(self, x, y, width, height, role, value):
        self.write(x, y, width, height, role)
        self.value(number(value) or '?', x+min(width/2, 14), y+1, 8.6, role)

    @staticmethod
    def one_line(text, width, font, size):
        text = clean(text)
        if pdfmetrics.stringWidth(text, font, size) <= width:
            return text
        words = text.split()
        while words and pdfmetrics.stringWidth(' '.join(words) + ' ...', font, size) > width:
            words.pop()
        return (' '.join(words) + ' ...') if words else 'See identity record'

    def attribute_card(self, which, x, y, width, height, c=None, dense=False):
        name, practices = GROUPS[which]
        self.molding(x, y, width, height, .982)
        rx, cy = x + (23 if dense else 27), y + (23 if dense else 25)
        self.seal(rx, cy, 17 if dense else 20)
        labelx = x + (44 if dense else 53)
        self.strap(labelx, y + 7, width - (labelx-x) - 6, 17)
        self.text(name.upper(), labelx+5, y+11, 7.5, 'Head', 1)
        self.value(number(self.stats['attributes'].get(name.lower()), True) or '?', rx, cy-7, 14, 'attribute_'+name.lower())
        card = [x, y, x+width, y+height]
        self.paired_metric('SAVE', labelx+4, y+30,
                           pdfmetrics.stringWidth('SAVE', 'Head', 6.1),
                           number(self.stats['saves'].get(name.lower()), True) or '?',
                           10, 'save_'+name.lower(), card, 6.1, 'Head')
        lookup = {row.get('practice', '').lower(): row for row in self.stats['practices']}
        label_size = 8.1 if dense else 8.5
        # A dense card has two independent label/value columns. Each uses its
        # longest practice label rather than the width of the entire card.
        label_widths = [max(pdfmetrics.stringWidth(p.title(), 'Body', label_size)
                            for i, p in enumerate(practices) if not dense or i % 2 == column)
                        for column in range(2 if dense else 1)]
        for index, practice in enumerate(practices):
            if dense:
                px, yy, pw = x+13+(index%2)*(width-15)/2, y+41+(index//2)*16, (width-15)/2
            else:
                px, yy, pw = x+12, y+51+index*11.5, width-14
            row = lookup.get(practice) or {}
            self.practice_mark(px+2, yy+3.5, practice, training_level(row, self.stats['pb']))
            self.paired_metric(practice.title(), px+10, yy,
                               label_widths[index % 2 if dense else 0],
                               number(row.get('total'), True) or '?', 8.2 if dense else 9,
                               'practice_'+practice, card, label_size,
                               cell_width=22 if dense else 26)
            end = self.metric_pairs[-1]['cell'][2]-self.origin_x
            self.metric_marks('skill_practice_check.'+practice, end+2, yy, x+width-7,
                              px+9 if dense else None, px+pw-4 if dense else None)

    def attribute(self, which, x, y, width, height, c=None):
        self.attribute_card(which, x, y, width, height+4, c)

    def compact_attribute(self, which, x, y, width, c=None):
        self.attribute_card(which, x, y, width, 76, c, True)

    def vital_bar(self, y, c=None):
        y += 3
        self.molding(self.left, y, self.right-self.left, 43, 1)
        widths = [144, 117, 47, 47, self.right-self.left-355]
        x = self.left+7
        for index, width in enumerate(widths):
            title = ['VITALITY', 'SHORT REST', 'DC', 'PB', 'MOVEMENT / ft'][index]
            self.text(title, x+2, y+5, 6.3, 'Head')
            if index in (0, 1):
                self.text('MAX' if index == 0 else 'CAP', x+2, y+14, 5.5, 'Label', g=.3)
                self.text('CURRENT' if index == 0 else 'LEFT', x+61, y+14, 5.5, 'Label', g=.3)
                self.value(number(self.stats['vitality' if index == 0 else 'restCap']) or '?', x+23, y+24, 12, 'vitality_max' if index == 0 else 'rest_cap')
                self.write(x+61, y+22, width-69, 15, 'current_vitality' if index == 0 else 'recovery_remaining')
            elif index in (2, 3):
                key = 'dc' if index == 2 else 'pb'
                self.value(number(self.stats[key], index == 3) or '?', x+width/2-3, y+24, 13, key)
            else:
                self.text(self.movement_text(('walk', 'climb', 'swim')), x+2, y+16, 7.6, 'Body')
                self.text(self.movement_text(('burrow', 'fly')), x+2, y+28, 7.6, 'Body')
                self.text('USED', x+100, y+29, 5.6, 'Label', g=.3)
                self.write(x+124, y+24, width-134, 12, 'movement_used')
            x += width
            if index < 4:
                self.line(x-4, y+6, x-4, y+37, .65, .35)

    def movement_text(self, keys=('walk', 'climb', 'swim', 'burrow', 'fly')):
        movement = self.stats['movement']
        if not isinstance(movement, dict):
            return clean(movement)
        labels = {'walk': 'Walk', 'climb': 'Climb', 'swim': 'Swim', 'burrow': 'Burrow', 'fly': 'Flight'}
        return ' / '.join(labels[key] + ' ' + (number(movement.get(key)) or '--') for key in keys)

    def live_column(self, x, y, width, c=None):
        self.band('VITALITY / RECOVERY', x, y, width, True)
        for index, (label, role, value) in enumerate([
                ('VITALITY MAX / CURRENT', 'current_vitality', self.stats['vitality']),
                ('REST CAP / LEFT', 'recovery_remaining', self.stats['restCap'])]):
            yy = y+25+index*40
            self.text(label, x+8, yy, 6.2, 'Head')
            self.value(number(value) or '?', x+33, yy+13, 14, 'vitality_max' if index == 0 else 'rest_cap')
            self.text('/', x+64, yy+15, 11, 'Display')
            self.write(x+78, yy+11, width-87, 20, role)
        for index, key in enumerate(('dc', 'pb')):
            xx = x+8+index*width/2
            self.text(key.upper(), xx, y+111, 6.3, 'Head')
            self.value(number(self.stats[key], key == 'pb') or '?', xx+42, y+106, 11, key)
        self.text('MOVEMENT / ft', x+8, y+130, 6.3, 'Head')
        self.text(self.movement_text(('walk', 'climb')), x+8, y+141, 8.1, 'Body')
        self.text(self.movement_text(('swim', 'burrow', 'fly')), x+8, y+153, 8.1, 'Body')
        self.text('USED', x+8, y+171, 6.1, 'Head')
        self.write(x+42, y+164, width-51, 15, 'movement_used')

    def access(self, x, y, width, c=None, vertical=False, source_rows=None):
        owned = {category: {access_value(row) for row in self.rows if row['category'] == category} for category in ACCESS}
        self.band_hint('OWNED ACCESS', x, y, width, PRACTICE_KEY)
        domain = ' / '.join(row['ref'] + ' ' + access_value(row) for row in self.rows if row['category'] == 'DOMAIN')
        if vertical:
            self.molding(x, y+23, width, 296, 1)
            self.text('Verbs:', x+12, y+32, 8.5, 'Body')
            for index, roman in enumerate(TIER_LABELS):
                self.check(x+12+(index%2)*75, y+48+(index//2)*16, TIER_LABELS[roman], 'verb_tier', roman in owned['VERB_TIER'], 8.5)
            self.text('DOMAINS', x+12, y+85, 6.8, 'Head')
            self.domain_text(domain, x+12, y+100, width-24, 9)
            self.write(x+12, y+112, width-24, 14, 'domains_extra')
            self.text('RANGE', x+12, y+136, 6.8, 'Head')
            for index, label in enumerate(RANGES):
                self.check(x+12+(index%2)*75, y+151+(index//2)*24, label, 'range', label in owned['RANGE'], 8, DISTANCES[index])
            self.text('OUTPUT DIE', x+12, y+225, 6.8, 'Head')
            for index, label in enumerate(DICE):
                self.check(x+12+(index%4)*36, y+242+(index//4)*20, label, 'output_die', label in owned['INTENSITY_DICE'], 8)
            self.plain('Dots record owned pieces. Full scope follows each P reference.', x+12, y+286, width-25, 7.6, 9.1)
        elif width < 400:
            self.text('Verbs:', x+7, y+24, 8, 'Body')
            for index, roman in enumerate(TIER_LABELS):
                self.check(x+58+index*(width-66)/4, y+23, TIER_LABELS[roman], 'verb_tier', roman in owned['VERB_TIER'], 8.5)
            self.text('DOMAINS', x+7, y+46, 6.3, 'Head')
            self.domain_text(domain, x+70, y+45, width-83, 9.4)
            self.text('RANGE', x+7, y+66, 6.2, 'Head')
            for index, label in enumerate(RANGES):
                self.check(x+7+index*(width-14)/6, y+80, label, 'range', label in owned['RANGE'], 7.8, DISTANCES[index])
            self.text('DIE', x+7, y+112, 6.2, 'Head')
            for index, label in enumerate(DICE):
                self.check(x+43+index*(width-51)/7, y+109, label, 'output_die', label in owned['INTENSITY_DICE'], 8)
        else:
            self.text('Verbs:', x+6, y+21, 8.4, 'Body')
            for index, roman in enumerate(TIER_LABELS):
                self.check(x+53+index*56, y+20, TIER_LABELS[roman], 'verb_tier', roman in owned['VERB_TIER'], 8.6)
            self.text('DOMAINS', x+300, y+22, 6.3, 'Head')
            self.domain_text(domain, x+363, y+21, width-369, 9.4)
            self.text('RANGE', x+6, y+45, 6.3, 'Head')
            for index, label in enumerate(RANGES):
                self.check(x+49+index*44, y+41, label, 'range', label in owned['RANGE'], 7.5, DISTANCES[index])
            self.text('DIE', x+327, y+45, 6.3, 'Head')
            for index, label in enumerate(DICE):
                self.check(x+353+(index%4)*34, y+41+(index//4)*12, label, 'output_die', label in owned['INTENSITY_DICE'], 7.5)
        for row in self.rows:
            if row['category'] in ACCESS:
                self.placed.append({'page': self.page, 'panel': self.panel, **row, 'area': 'owned_access', 'display_value': access_value(row)})

    def make_queue(self, records, primitive=False, density=None):
        queue = deque()
        for record in records:
            title = (record.get('ref', '') + ' / ' if record.get('ref') else '') + record['name']
            body = record.get('rule', '') if primitive else record.get('body', '')
            portrait = self.media(record, portrait=True) if record.get('entity_kind') in ('character', 'heritage') else None
            icon = None if portrait else self.media(record)
            html = '<b>' + escape(clean(title)) + '</b>' + (' · ' if primitive else '<br/>') + markdown_html(clean(body))
            if record.get('sections'):
                sections = []
                for section in record['sections']:
                    content = markdown_html(clean(section['text']))
                    label = '<b>'+escape(section['label'])+'</b><br/>' if section['label'] else ''
                    if section['kind'] == 'mechanical':
                        color = '#904422' if self.color_edition else '#222222'
                        content = f'<font color="{color}"><b>{content}</b></font>'
                    sections.append(label+content)
                html = '<b>'+escape(clean(title))+'</b><br/>'+'<br/>'.join(sections)
            leading = 12.0 if self.landscape and primitive and density == 'normal' else RULE_LEADING
            queue.append({'record': record, 'paragraph': self.paragraph_object(html, leading=leading, first_line_indent=15 if icon else 0),
                          'continued': False, 'icon': icon, 'portrait': portrait,
                          'portrait_width': 100, 'portrait_height': 104})
        return queue

    def flow_queue(self, queue, regions, area, draw=True):
        """Split oversized records at line boundaries; every nonempty region progresses."""
        self.last_flow_ends = []
        first_column_remaining = None
        if len(regions) == 2 and len(queue) > 1 and abs(regions[0][2]-regions[1][2]) < .1:
            width = regions[0][2]
            heights = []
            for entry in queue:
                _, height = entry['paragraph'].wrap(width-8-(108 if entry.get('portrait') else 0), 100000)
                height = max(height, 106 if entry.get('portrait') else 0)
                heights.append(height+7+(10 if entry['continued'] else 0))
            capacities = [r[3]-r[1] for r in regions]
            candidates = [index for index in range(1, len(heights))
                          if sum(heights[:index]) <= capacities[0] and sum(heights[index:]) <= capacities[1]]
            if candidates:
                split = min(candidates, key=lambda index: abs(sum(heights[:index])-sum(heights[index:])))
                first_column_remaining = len(queue)-split
        for column, (x, top, width, bottom) in enumerate(regions):
            y = top
            while queue:
                if column == 0 and first_column_remaining is not None and len(queue) <= first_column_remaining:
                    break
                entry = queue[0]
                paragraph = entry['paragraph']
                continuation_height = 10 if entry['continued'] else 0
                portrait = entry.get('portrait') if not entry['continued'] else None
                inset = 108 if portrait else 0
                available = bottom-y-5-continuation_height
                if available < RULE_LEADING:
                    break
                _, height = paragraph.wrap(width-8-inset, 100000)
                paragraph_height = height
                height = max(height, 106 if portrait else 0)
                piece, rest = paragraph, []
                if height > available:
                    # Prefer a whole entry in the next region unless this entry
                    # itself exceeds a fresh region's capacity.
                    full_capacity = bottom-top-5-continuation_height
                    if y > top+1 and height <= full_capacity:
                        break
                    if portrait and available < 106:
                        break
                    parts = paragraph.split(width-8-inset, available)
                    if not parts:
                        break
                    piece, rest = parts[0], parts[1:]
                    _, paragraph_height = piece.wrap(width-8-inset, available)
                    height = max(paragraph_height, 106 if portrait else 0)
                if draw:
                    if entry['continued']:
                        reference = entry['record'].get('ref') or entry['record']['name']
                        self.text(reference+' / continued', x+4, y, 6.8, 'Head', g=.3)
                    body_y = y+continuation_height
                    if portrait:
                        self.paint_media(portrait, x+4, body_y, entry['portrait_width'], entry['portrait_height'],
                                         'heritage_portrait' if entry['record'].get('entity_kind') == 'heritage' else 'character_identity_portrait', True)
                    elif entry.get('icon') and not entry['continued']:
                        self.paint_media(entry['icon'], x+4, body_y+.5, 10.5, 10.5, 'entity_icon')
                    piece.drawOn(self.c, x+4+inset, self.height-body_y-paragraph_height)
                    self.texts.append({'page': self.page, 'panel': self.panel, 'text': piece.getPlainText(),
                                       'rendered_text': piece.getPlainText(),
                                       'box': self.absolute_box([x+4+inset, body_y, x+width-4, body_y+paragraph_height]),
                                       'font': 'Body', 'size': RULE_SIZE, 'paragraph': True})
                    record = entry['record']
                    self.segments.append({'page': self.page, 'panel': self.panel, 'area': area,
                                          'ref': record.get('ref'), 'name': record['name'],
                                          'continued': entry['continued'], 'text': piece.getPlainText(),
                                          'rendered_text': piece.getPlainText(),
                                          'source_markdown': record.get('rule', record.get('body', '')),
                                          'box': self.absolute_box([x+4+inset, body_y, x+width-4, body_y+paragraph_height])})
                    if not entry['continued']:
                        self.placed.append({'page': self.page, 'panel': self.panel, **record, 'area': area})
                    self.line(x+3, body_y+height+3, x+width-4, body_y+height+3, .72, .3)
                queue.popleft()
                for fragment in reversed(rest):
                    queue.appendleft({'record': entry['record'], 'paragraph': fragment, 'continued': True,
                                      'icon': None, 'portrait': None})
                y += continuation_height+height+7
            self.last_flow_ends.append(y)
        return queue

    def front_regions(self, density):
        if self.landscape:
            width = self.right-self.left
            gap = self.gap if density == 'compact' else 14.
            cw = (width-gap)/2
            return [(self.left, 124, cw, 555), (self.left+cw+gap, 124, cw, 555)]
        if density == 'compact':
            cw = (self.right-self.left-self.gap)/2
            return [(self.left, 352, cw, 665), (self.left+cw+self.gap, 352, cw, 665)]
        if self.arch == 'stack':
            return [(216, 284, self.right-216, 637)]
        return [(self.left if self.arch == 'right' else 216, 311,
                 343.276 if self.arch == 'right' else self.right-216, 637)]

    def choose_density(self):
        counts = {}
        for density in ('normal', 'compact'):
            pending = self.make_queue(self.front_rows, True, density)
            self.flow_queue(pending, self.front_regions(density), 'measure', False)
            remaining = len(pending)
            # A split single record remains pending even after partial fit.
            counts[density] = remaining
        self.density_measurements = {'remaining_records': counts, 'rule_font_size': RULE_SIZE,
                                     'rule_leading': RULE_LEADING, 'basis': 'Measured full preferred text in actual front regions'}
        requested = self.options['density']
        if requested != 'auto':
            return requested
        if counts['normal'] == 0:
            return 'normal'
        return 'compact'

    def ledger_runtime(self, x, y, width, bottom, queue, compact=False):
        self.band_hint('PRIMITIVES / REUSABLE EFFECTS', x, y, width,
                       'Rules continue by P reference.' if compact else PRACTICE_KEY)
        start = y+24
        if compact:
            cw = (width-self.gap)/2
            regions = [(x, start, cw, bottom), (x+cw+self.gap, start, cw, bottom)]
        else:
            regions = [(x, start, width, bottom)]
        self.flow_queue(queue, regions, 'primitive_rules')
        self.extra_primitive_lines(regions)

    def extra_primitive_lines(self, regions):
        for (x, top, width, bottom), ending in zip(regions, self.last_flow_ends):
            for yy in range(int(ending+5), int(bottom-12), 14):
                self.write(x+5, yy, width-10, 14, 'primitive_additions')

    def state_rail(self, y, c=None):
        self.text('ACTIVE EFFECTS / END WHEN', self.left, y, 6.2, 'Head')
        self.write(self.left+174, y-3, self.right-self.left-174, 16, 'ongoing_endings')

    def footer_state(self, c=None):
        y = 798
        self.text('REACTION', self.left, y+1, 5.8, 'Head')
        self.check(self.left+50, y-1, '', 'reaction', False, meaning='intent')
        self.text('EQUIPPED SLOTS', self.left+75, y+1, 5.8, 'Head')
        self.pencil_value(self.left+156, y-4, 43, 15, 'slots_used', self.stats['equippedSlotsUsed'])
        self.text('/ '+(number(self.stats['slotCapacity']) or '___'), self.left+202, y, 8.4, 'Body')
        self.text('LOAD / capacity', self.left+249, y+1, 5.8, 'Head')
        self.pencil_value(self.left+329, y-4, 43, 15, 'load_current', self.stats['currentLoad'])
        self.text('/ '+(number(self.stats['carryCapacity']) or '___'), self.left+376, y, 8.4, 'Body')

    def front_portrait(self, density):
        compact = density == 'compact'
        pending = self.make_queue(self.front_rows, True)
        self.begin('front', ('DENSE' if compact else 'NORMAL')+' / CHARACTER FRONT')
        self.roles[-1]['density'] = density
        self.identity()
        self.inner_structure(not compact)
        width = (self.right-self.left-2*self.gap)/3
        if compact:
            self.vital_bar(122)
            for index in range(3):
                self.compact_attribute(index, self.left+index*(width+self.gap), 174 if index == 1 else 177, width)
            self.access(self.left, 259, self.right-self.left)
            self.ledger_runtime(self.left, 328, self.right-self.left, 665, pending, True)
            self.state_rail(668)
        elif self.arch == 'stack':
            for index, (yy, height) in enumerate([(129, 90), (230, 101), (344, 90)]):
                self.attribute(index, self.left, yy, 159, height)
            self.live_column(self.left, 448, 159)
            self.access(216, 129, self.right-216)
            self.ledger_runtime(216, 260, self.right-216, 637, pending)
            self.text('ACTIVE EFFECTS / END WHEN', self.left+2, 643, 6.3, 'Head')
            self.write(self.left+142, 639, self.right-self.left-142, 14, 'ongoing_endings')
        else:
            self.vital_bar(122)
            for index in range(3):
                self.attribute(index, self.left+index*(width+self.gap), 174 if index == 1 else 185, width, 101 if index == 1 else 90)
            if self.arch == 'right':
                self.ledger_runtime(self.left, 287, 343.276, 637, pending)
                self.access(self.right-159, 287, 159, vertical=True)
            else:
                self.access(self.left, 287, 159, vertical=True)
                self.ledger_runtime(216, 287, self.right-216, 637, pending)
            self.text('ACTIVE EFFECTS / END WHEN', self.left+2, 643, 6.3, 'Head')
            self.write(self.left+142, 639, self.right-self.left-142, 14, 'ongoing_endings')
        self.scaling(688 if compact else 658, compact=compact)
        self.footer_state()
        self.end()
        self.flow_continuations(pending, 'primitive continuation', 'PRIMITIVES / CONTINUED', primitive=True)

    def landscape_attribute(self, which, y):
        x, width = self.left, self.right-self.left
        name, practices = GROUPS[which]
        self.molding(x, y, width, 43, .982)
        self.seal(x+23, y+21, 15)
        self.value(number(self.stats['attributes'].get(name.lower()), True) or '?', x+23, y+14, 13, 'attribute_'+name.lower())
        self.strap(x+47, y+5, 86, 14)
        self.text(name.upper(), x+52, y+8, 7.2, 'Head', 1)
        card = [x, y, x+width, y+43]
        self.paired_metric('SAVE', x+49, y+27,
                           pdfmetrics.stringWidth('SAVE', 'Head', 6.1),
                           number(self.stats['saves'].get(name.lower()), True) or '?',
                           9.2, 'save_'+name.lower(), card, 6.1, 'Head')
        lookup = {row.get('practice', '').lower(): row for row in self.stats['practices']}
        label_widths = [max(pdfmetrics.stringWidth(p.title(), 'Body', 8.8)
                            for i, p in enumerate(practices) if i % 2 == column)
                        for column in range(2)]
        for index, practice in enumerate(practices):
            xx, yy = x+149+(index%2)*102, y+7+(index//2)*18
            row = lookup.get(practice) or {}
            self.practice_mark(xx, yy+3.5, practice, training_level(row, self.stats['pb']))
            self.paired_metric(practice.title(), xx+8, yy, label_widths[index % 2],
                               number(row.get('total'), True) or '?', 9.2,
                               'practice_'+practice, card, 8.8)
            self.metric_marks('skill_practice_check.'+practice, 0, yy, 0, xx+8,
                              min(xx+100, x+width-5))

    def landscape_access(self, y):
        x, width = self.left, self.right-self.left
        self.band_hint('OWNED ACCESS', x, y, width, PRACTICE_KEY)
        owned = {category: {access_value(row) for row in self.rows if row['category'] == category} for category in ACCESS}
        self.text('Verbs:', x+4, y+20, 8.4, 'Body')
        for index, roman in enumerate(TIER_LABELS):
            self.check(x+52+index*70, y+19, TIER_LABELS[roman], 'verb_tier', roman in owned['VERB_TIER'], 8.6)
        self.text('DOMAINS', x+4, y+35, 6.3, 'Head')
        domain = ' / '.join(row['ref']+' '+access_value(row) for row in self.rows if row['category'] == 'DOMAIN')
        self.domain_text(domain, x+65, y+34, width-68, 9.6)
        for index, label in enumerate(RANGES):
            self.check(x+4+index*(width-8)/6, y+50, label, 'range', label in owned['RANGE'], 7.8, DISTANCES[index])
        self.text('DIE', x+4, y+76, 6.3, 'Head')
        for index, label in enumerate(DICE):
            self.check(x+35+index*(width-40)/7, y+73, label, 'output_die', label in owned['INTENSITY_DICE'], 8.5)
        for row in self.rows:
            if row['category'] in ACCESS:
                self.placed.append({'page': self.page, 'panel': self.panel, **row, 'area': 'owned_access', 'display_value': access_value(row)})

    def landscape_scaling(self, y, compact=False):
        x, width = self.left, self.right-self.left
        self.band('AT THE TABLE / DECLARE YOUR SCALE', x, y, width, True)
        self.text('Intent, not purchases. Agree access, CV, Strain and Cost.', x+4, y+18, 7.5, 'Body')
        self.text('DICE COUNT', x+253, y+19, 6, 'Head')
        self.write(x+307, y+12, width-311, 14, 'dice_count')
        yy = y+(27 if compact else 36)
        for label, values in AXES:
            label_width = 72 if compact else 83
            values_left = x+(80 if compact else 95)
            self.rect(x+3, yy, label_width, 10, .92)
            self.text(label.upper(), x+7, yy+2, 6.0, 'Head')
            xx, rowy = values_left, yy+1
            for value in values:
                need = 11+pdfmetrics.stringWidth(value, 'Body', 8.2)+7
                if xx+need > self.right-3:
                    xx, rowy = values_left, rowy+(10 if compact else 11)
                xx += self.check(xx, rowy, value, 'intent_'+label.lower().replace(' ', '_'), False, 8.2, meaning='intent')
            yy = rowy+(10 if compact else 15)

    def front_landscape(self, density):
        x, width = self.left, self.right-self.left
        self.front_density = density
        self.begin('front / core', ('DENSE' if density == 'compact' else 'NORMAL')+' / FOLDABLE CORE')
        self.roles[-1]['density'] = density
        portrait = self.media(portrait=True)
        identity_left = x+(48 if portrait else 0)
        if portrait:
            self.paint_media(portrait, x, 82, 40, 40, 'character_portrait', True,
                             self.character.get('portraitFrame') or {})
        self.text(self.one_line(self.character.get('name') or 'Unnamed character', self.right-identity_left, 'Display', 17), identity_left, 83, 17, 'Display')
        balance = self.character.get('buBalance') or {}
        self.text(f"LEVEL / BU  {number(self.character.get('level')) or '?'} / {number(balance.get('progressionSpent')) or '?'} of {number(balance.get('progressionPool')) or '?'} BU  /  Available {number(available_bu(self.character)) or '?'}", identity_left+4, 110, 7.6, 'Head')
        self.text(self.debt_text()+f"  /  Item BU {number(balance.get('itemBuSpent')) or '?'}", identity_left+4, 120, 6.7, 'Body')
        heritages = ' / '.join(clean((link.get('heritage') or {}).get('name')) for link in self.character.get('heritageLinks') or [])
        concept = unique_text([self.character.get('concept'), heritages]).replace('\n', ' / ')
        self.text(self.one_line('CONCEPT / HERITAGES  '+(concept or 'See identity record'), self.right-identity_left-8, 'Body', 6.8), identity_left+4, 101, 6.8, 'Body')
        self.molding(x, 128, width, 42, 1)
        for index, (title, value, current_role) in enumerate([
                ('VITALITY MAX / CURRENT', self.stats['vitality'], 'current_vitality'),
                ('REST CAP / LEFT', self.stats['restCap'], 'recovery_remaining')]):
            xx = x+8+index*127
            self.text(title, xx, 135, 6.1, 'Head')
            self.value(number(value) or '?', xx+19, 151, 14, 'vitality_max' if index == 0 else 'rest_cap')
            self.text('/', xx+40, 153, 12, 'Display')
            self.write(xx+55, 142, 55, 22, current_role)
        self.text('DC', x+268, 135, 6.2, 'Head')
        self.value(number(self.stats['dc']) or '?', x+278, 151, 13, 'dc')
        self.text('PB', x+314, 135, 6.2, 'Head')
        self.value(number(self.stats['pb'], True) or '?', x+325, 151, 13, 'pb')
        for index in range(3):
            self.landscape_attribute(index, 174+index*48)
        self.landscape_access(321)
        self.landscape_scaling(406, compact=True)
        self.text('MOVEMENT / ft', x+4, 524, 6.1, 'Head')
        self.text(self.movement_text(('walk', 'climb', 'swim')), x+4, 535, 8.1, 'Body')
        self.text(self.movement_text(('burrow', 'fly')), x+172, 535, 8.1, 'Body')
        self.text('USED', self.right-65, 524, 6.2, 'Head')
        self.write(self.right-38, 518, 35, 15, 'movement_used')
        self.text('REACTION', x+4, 557, 6, 'Head')
        self.check(x+54, 554, '', 'reaction', False, meaning='intent')
        self.text('EQUIPPED', x+80, 557, 5.4, 'Head')
        self.pencil_value(x+116, 550, 27, 13, 'slots_used', self.stats['equippedSlotsUsed'])
        self.text('/ '+(number(self.stats['slotCapacity']) or '___'), x+143, 555, 8, 'Body')
        self.text('LOAD', x+190, 557, 6, 'Head')
        self.pencil_value(x+221, 550, 35, 13, 'load_current', self.stats['currentLoad'])
        self.text('/ '+(number(self.stats['carryCapacity']) or '___'), x+260, 555, 8, 'Body')
        self.end()
        self.begin('front / primitives', ('DENSE' if density == 'compact' else 'NORMAL')+' / OWNED INGREDIENTS')
        self.text(self.one_line(self.character.get('name') or 'Unnamed character', width, 'Body', 9.2), x+4, 85, 9.2, 'Body')
        self.band_hint('PRIMITIVES / REUSABLE EFFECTS', x, 100, width, 'Full rules / stable P references')
        pending = self.make_queue(self.front_rows, True, density)
        regions = self.front_regions(density)
        self.flow_queue(pending, regions, 'primitive_rules')
        self.extra_primitive_lines(regions)
        self.end()
        self.flow_continuations(pending, 'primitive continuation', 'PRIMITIVES / CONTINUED', primitive=True)

    def heading(self, title):
        size = 14 if self.landscape else 16
        self.text(title, self.left, 85, size, 'Display')

    def section_header(self, title):
        self.text(self.one_line(self.character.get('name') or 'Unnamed character', self.right-self.left, 'Body', 9.2), self.left+4, 85, 9.2, 'Body')
        self.band(title, self.left, 101, self.right-self.left, True)
        return 126

    def flow_continuations(self, pending, role, title, primitive=False):
        while pending:
            previous = (len(pending), sum(len(item['paragraph'].getPlainText()) for item in pending))
            self.begin(role, title)
            top = self.section_header(title)
            bottom = self.height-48
            if self.landscape:
                regions = [(self.left, top, self.right-self.left, bottom)]
            else:
                width = (self.right-self.left-self.gap)/2
                regions = [(self.left, top, width, bottom), (self.left+width+self.gap, top, width, bottom)]
            self.flow_queue(pending, regions, 'primitive_rules' if primitive else role)
            after = (len(pending), sum(len(item['paragraph'].getPlainText()) for item in pending))
            if after >= previous:
                raise ValueError('A full rule could not progress through a continuation panel')
            if not pending and self.last_flow_ends:
                last = max(self.last_flow_ends)
                if bottom-last > 90:
                    self.band('NOTES / AGREED CHANGES / SOURCE', self.left, last+16, self.right-self.left, True)
                    for yy in range(int(last+45), int(bottom-12), 15):
                        self.write(self.left+5, yy, self.right-self.left-10, 15, 'rule_session_notes')
            self.end()

    def supporting_section(self, records, role, title):
        if not records:
            return
        self.flow_continuations(self.make_queue(records), role, title)

    def equipment_pages(self):
        items = self.groups['items']
        if not items:
            return
        pending = deque(items)
        rule_queue = self.make_queue(items)
        while pending:
            self.begin('equipment', 'EQUIPMENT / QUANTITY / LOAD')
            x, width = self.left, self.right-self.left
            self.section_header('EQUIPMENT / ITEM BU')
            if self.landscape:
                starts = [0, 20, width-133, width-104, width-70, width-37]
                labels = ['EQ', 'ITEM / REF', 'QTY', 'LOAD', 'SLOTS', 'BU']
            else:
                starts = [0, 21, 273, 310, 353, 398, 453]
                labels = ['EQ', 'ITEM / REF', 'QTY', 'LOAD', 'SLOTS', 'ITEM BU', 'STATE']
            self.rect(x, 126, width, 16, .92)
            for offset, label in zip(starts, labels):
                self.text(label, x+offset+3, 131, 6.3, 'Head')
            y, limit = 149, self.height-105
            while pending:
                item = pending[0]
                name = item['ref']+' / '+item['name']
                name_width = starts[2]-starts[1]-8
                height = max(21, self.plain(name, x+starts[1]+3, y+3, name_width, 9.2, 11.2, False)+8)
                if y+height > limit:
                    if y == 149:
                        # Keep table concise but preserve the full unbroken name
                        # in the item source record below.
                        name = self.one_line(name, name_width, 'Body', 9.2)
                        height = 24
                    else:
                        break
                pending.popleft()
                self.check(x+4, y+3, '', 'equipped', item['equipped'])
                self.plain(name, x+starts[1]+3, y+3, name_width, 9.2, 11.2)
                values = [number(item['quantity']), number(item['load']), number(item['slots']), number(item['item_bu'])]
                if not self.landscape:
                    values.append('equipped' if item['equipped'] else 'carried')
                for index, value in enumerate(values, 2):
                    self.text(value or '?', x+starts[index]+3, y+4, 8.7, 'Body')
                for offset in starts[1:]:
                    self.line(x+offset-2, y-1, x+offset-2, y+height-2, .73, .3)
                self.line(x, y+height-2, self.right, y+height-2, .65, .35)
                self.source_blocks.append({'page': self.page, 'panel': self.panel, 'name': name,
                                           'table_values': values, 'quantity': item['quantity'],
                                           'load': item['load'], 'equipped_slots': item['slots'], 'item_bu': item['item_bu']})
                y += height
            y += 12
            self.text('EQUIPPED SLOTS / max', x+4, y, 6.4, 'Head')
            self.pencil_value(x+109, y-5, 28, 17, 'slots_current', self.stats['equippedSlotsUsed'])
            self.text('/ '+(number(self.stats['slotCapacity']) or '___'), x+141, y-1, 9, 'Body')
            xx = x+195 if not self.landscape else x+4
            yy = y if not self.landscape else y+27
            self.text('LOAD / capacity', xx, yy, 6.4, 'Head')
            self.pencil_value(xx+90, yy-5, 38, 17, 'load_current', self.stats['currentLoad'])
            self.text('/ '+(number(self.stats['carryCapacity']) or '___'), xx+132, yy-1, 9, 'Body')
            if not pending:
                rule_top = yy+39
                if self.height-48-rule_top > 90:
                    self.band('ITEM RULES / SOURCE / ENDING', x, rule_top, width, True)
                    if self.landscape:
                        regions = [(x, rule_top+26, width, self.height-62)]
                    else:
                        cw = (width-self.gap)/2
                        regions = [(x, rule_top+26, cw, self.height-62), (x+cw+self.gap, rule_top+26, cw, self.height-62)]
                    self.flow_queue(rule_queue, regions, 'item rules')
                    if not rule_queue and self.last_flow_ends and self.height-62-max(self.last_flow_ends) > 90:
                        last = max(self.last_flow_ends)
                        self.band('ITEM STATE / QUANTITIES / REPAIRS', x, last+15, width, True)
                        for yy in range(int(last+43), int(self.height-76), 15):
                            self.write(x+5, yy, width-10, 15, 'item_scene_notes')
            self.text('Current equipment totals are printed on writable lines; update them as gear changes.', x+4, self.height-48, 7.2, 'Body', g=.3)
            self.end()
        self.flow_continuations(rule_queue, 'item rules', 'ITEM RULES / SOURCE / ENDING')

    def workbench_runtime(self):
        if not self.landscape:
            self.begin('blank workbench', 'IN PLAY / COMPOSE / ACQUIRE')
            self.heading('The working surface')
            self.text('CHARACTER', self.left+4, 111, 6.2, 'Head')
            self.write(self.left+64, 104, self.right-self.left-68, 18, 'workbench_character')
            self.scaling(130, compact=True)
            self.text('REACH', self.left+8, 251, 6.2, 'Head')
            for index, label in enumerate(RANGES):
                self.check(self.left+52+index*44, 248, label, 'chosen_range', False, 7.7, meaning='intent')
            self.text('DIE', self.left+329, 251, 6.2, 'Head')
            for index, label in enumerate(DICE):
                self.check(self.left+354+(index%4)*34, 248+(index//4)*12, label, 'chosen_die', False, 7.5, meaning='intent')
            self.band('NEW COMPOSITIONS / REUSE OWNED INGREDIENTS', self.left, 278, self.right-self.left, True)
            cw = (self.right-self.left-self.gap)/2
            for column in range(2):
                for row in range(2):
                    x, y = self.left+column*(cw+self.gap), 305+row*135
                    self.molding(x, y, cw, 125, 1)
                    self.text(f'{column*2+row+1:02}', x+9, y+9, 8, 'Head')
                    self.text('INTENT / NAME', x+30, y+9, 6.2, 'Head')
                    self.write(x+111, y+3, cw-125, 18, 'composition_name')
                    self.text('Owned refs', x+10, y+31, 7.3, 'Body')
                    self.write(x+77, y+25, cw-91, 18, 'ingredient_refs')
                    self.text('OUTCOME / SCOPE / RESOLUTION', x+10, y+49, 6, 'Head')
                    for offset in (57, 70):
                        self.write(x+10, y+offset, cw-23, 13, 'scope_resolution')
                    self.text('CV / Strain / Cost', x+10, y+89, 6.8, 'Body')
                    self.write(x+107, y+84, cw-121, 17, 'complexity_cost')
                    self.text('Upkeep / ending', x+10, y+109, 6.8, 'Body')
                    self.write(x+104, y+103, cw-118, 17, 'upkeep_ending')
            self.band('NEW PRIMITIVES / AGREED DURING PLAY', self.left, 582, self.right-self.left, True)
            self.rect(self.left, 606, self.right-self.left, 13, .92)
            self.text('REF / NAME + ACTUAL RULE', self.left+6, 609, 6.4, 'Head')
            self.text('BU / SOURCE / AGREEMENT', self.right-149, 609, 6.4, 'Head')
            for index in range(7):
                y = 624+index*18
                self.jewel(self.left+7, y+7, 3)
                self.write(self.left+22, y, self.right-self.left-27, 18, 'midgame_primitive')
            for label, x, line_x, role in [('BU before', 5, 62, 'bu_before'), ('Spent', 121, 156, 'bu_spent'), ('Left', 215, 239, 'bu_remaining')]:
                self.text(label, self.left+x, 779, 7, 'Body')
                self.write(self.left+line_x, 773, 40, 18, role)
            self.text('Update main record', self.left+304, 779, 7, 'Body')
            self.check(self.left+410, 778, '', 'main_record_updated', False, meaning='intent')
            self.end()
            return
        self.begin('workbench / compositions', 'IN PLAY / COMPOSE')
        self.heading('The working surface')
        width = self.right-self.left
        self.band('NEW COMPOSITIONS / OWNED REFS', self.left, 118, width, True)
        for index in range(3):
            x, y = self.left, 150+index*111
            self.molding(x, y, width, 101, 1)
            self.text('INTENT / NAME', x+10, y+10, 6.3, 'Head')
            self.write(x+107, y+3, width-121, 20, 'composition_name')
            self.text('Owned refs / outcome', x+10, y+34, 7.8, 'Body')
            self.write(x+130, y+27, width-144, 20, 'ingredient_refs_outcome')
            self.text('CV / Strain / Cost', x+10, y+57, 7.8, 'Body')
            self.write(x+119, y+50, width-133, 20, 'complexity_cost')
            self.text('Upkeep / ending', x+10, y+80, 7.8, 'Body')
            self.write(x+109, y+73, width-123, 20, 'upkeep_ending')
        self.end()
        self.begin('workbench / acquisitions', 'IN PLAY / ACQUIRE')
        self.heading('New owned ingredients')
        self.band('NEW PRIMITIVES / TABLE AGREEMENT', self.left, 118, width, True)
        self.plain('Ref / name + full actual rule / BU / source / agreement. Reusing a reference does not purchase it again.', self.left+5, 143, width-10, 9.2, 11.2)
        for y in range(182, 507, 26):
            self.write(self.left+6, y, width-12, 25, 'midgame_primitive')
        self.text('BU before', self.left+4, 539, 7.6, 'Body')
        self.write(self.left+60, 531, 40, 20, 'bu_before')
        self.text('Spent', self.left+121, 539, 7.6, 'Body')
        self.write(self.left+157, 531, 40, 20, 'bu_spent')
        self.text('Left', self.left+220, 539, 7.6, 'Body')
        self.write(self.left+247, 531, 40, 20, 'bu_remaining')
        self.end()

    def generate(self):
        density = self.choose_density()
        if self.landscape:
            self.front_landscape(density)
        else:
            self.front_portrait(density)
        self.supporting_section(self.groups['capabilities'] + self.groups['effects'], 'capabilities and effects', 'COMPOSITIONS / REUSABLE EFFECTS')
        self.equipment_pages()
        self.supporting_section(self.groups['full_rules'], 'full authored rules', 'PRIMITIVES / FULL AUTHORED SCOPE')
        self.supporting_section(self.groups['identity'], 'identity and notes', 'CONCEPT / STORY / ADVANCEMENT')
        if self.options['workbench']:
            self.workbench_runtime()
        if self.landscape and self.panel == 1:
            self.begin('notes', 'NOTES / AGREED CHANGES')
            top = self.section_header('NOTES / SOURCE / AGREEMENT')
            for y in range(top, 541, 16):
                self.write(self.left+5, y, self.right-self.left-10, 16, 'session_notes')
            self.end()
        self.c.save()
        reader = PdfReader(BytesIO(self.stream.getvalue()))
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        for name in ('Aubrey', 'Syne', 'UnicaOne', 'Oxanium'):
            notice = ASSETS / 'fonts' / f'{name}-OFL.txt'
            if not notice.is_file():
                raise FileNotFoundError('Character PDF font notice is missing')
            writer.add_attachment(notice.name, notice.read_bytes())
        if self.media_credits:
            credit_text = ('SwordWeave character PDF — image and icon credits\n\n'+
                           '\n'.join(sorted(self.media_credits))+
                           '\n\nGame-icons.net icons retain their original authors and CC BY 3.0 license.\n'+
                           'License: https://creativecommons.org/licenses/by/3.0/\n'+
                           ('Changes for this character sheet: rendered in color and resized for print.\n' if self.color_edition else
                            'Changes for this character sheet: rendered in monochrome and resized for print.\n'))
            writer.add_attachment('SwordWeave-image-and-icon-credits.txt', credit_text.encode('utf-8'))
        writer.add_metadata({'/Title': f"SwordWeave / {clean(self.character.get('name'))} / {self.name}",
                             '/Author': 'SwordWeave', '/Subject': 'Character sheet / '+density+' / '+self.options['orientation']+(' / color' if self.color_edition else ''),
                             '/Creator': 'SwordWeave local character PDF renderer'})
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open('wb') as stream:
            writer.write(stream)
        result = {'version': 1, 'path': str(self.path), 'sha256': hashlib.sha256(self.path.read_bytes()).hexdigest(),
                  'pages': len(reader.pages), 'page_size': self.page_size, 'options': self.options,
                  'chosen_density': density, 'density_measurements': self.density_measurements,
                  'roles': self.roles, 'text_boxes': self.texts, 'writing_fields': self.writing,
                  'practice_marks': self.marks, 'choices': self.choices, 'numeric_values': self.numeric,
                  'metric_pairs': self.metric_pairs,
                  'roll_annotations': self.roll_annotations,
                  'media_placements': self.media_placements, 'media_credits': sorted(self.media_credits),
                  'media_decode_failures': self.media_failures,
                  'rule_placements': self.placed, 'rule_segments': self.segments, 'source_records': self.groups,
                  'primitive_records': self.rows, 'source_blocks': self.source_blocks,
                  'art_placements': self.art, 'frame_joins': self.joins, 'font_mapping': self.font_mapping,
                  'raster_assets': {key: {'path': str(value['path']), 'sha256': hashlib.sha256(value['path'].read_bytes()).hexdigest(),
                                           **{field: value[field] for field in ('color_space', 'embedded_rgb_sha256', 'embedded_gray_sha256', 'embedded_alpha_sha256')}}
                                    for key, value in self.assets.items()},
                  'color_theme': {'name': 'SwordWeave gold / teal / silver', 'simulated_metal': True,
                                  'body_ink': theme.INK, 'gold': theme.GOLD, 'teal': theme.TEAL} if self.color_edition else None,
                  'front_order': [row['ref'] for row in self.front_rows],
                  'fold_gutter': [self.page_size[0]/2-FOLD_CLEARANCE/2, self.page_size[0]/2+FOLD_CLEARANCE/2] if self.landscape else None}
        return result


def validate_request(request):
    if not isinstance(request, dict) or not isinstance(request.get('character'), dict):
        raise ValueError('Expected a character snapshot object')
    options = request.get('options') or {}
    if not isinstance(options, dict):
        raise ValueError('Expected PDF options object')
    normalized = {'style': options.get('style', 'aegis'), 'density': options.get('density', 'auto'),
                  'orientation': options.get('orientation', 'portrait'), 'workbench': bool(options.get('workbench', False)),
                  'color': options.get('color', False)}
    if not isinstance(normalized['color'], bool):
        raise ValueError('Color must be a boolean')
    if normalized['style'] not in {style[0] for style in STYLES}:
        raise ValueError('Unknown character-sheet style')
    if normalized['density'] not in ('auto', 'normal', 'compact'):
        raise ValueError('Density must be auto, normal, or compact')
    if normalized['orientation'] not in ('portrait', 'landscape'):
        raise ValueError('Orientation must be portrait or landscape')
    return request['character'], normalized


def render(request, output, manifest_path=None):
    character, options = validate_request(request)
    output = Path(output).resolve()
    folio = RuntimeFolio(character, options, output)
    result = folio.generate()
    if manifest_path:
        manifest_path = Path(manifest_path).resolve()
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(result, indent=2) + '\n')
    return result
