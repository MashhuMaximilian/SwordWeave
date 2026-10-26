"""Meaningful export regressions: dynamic values, safe pagination, fold clearance.

Run with the same Python runtime as the exporter:
  python -m unittest discover -s scripts/character_pdf -p 'test_*.py'
"""
import json
from io import BytesIO
import base64
from pathlib import Path
import re
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from character_pdf.renderer import (ASSETS, primitive_records, render, stats,
                                     supporting_records, training_level, validate_request, access_value,
                                     RuntimeFolio, STYLES, GROUPS)
from character_pdf.renderer import debt_account
from character_pdf.markdown import markdown_html
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw
from reportlab.pdfbase import pdfmetrics


def character(count=1, long_rule=False):
    primitive_links = []
    for index in range(count):
        rule = ('A uniquely numbered rule ' + str(index) + ' changes only its named target. ')
        if long_rule and index == 0:
            rule += ' '.join(f'paragraphword{word}' for word in range(3000))
        primitive_links.append({'instanceId': f'occurrence-{index}', 'isMirrored': index == 1,
                                'primitive': {'id': index, 'name': f'Owned rule {index}',
                                              'category': 'CUSTOM', 'narrativeRule': rule}})
    return {'id': 'pdf-test', 'name': 'The Pagination Witness', 'level': 3,
            'primitiveLinks': primitive_links, 'capabilityLinks': [], 'effectLinks': [],
            'heritageLinks': [], 'itemLinks': [], 'readOnlyGraph': {'nodes': [], 'edges': []},
            'backstory': {'origin': 'A full printed origin survives export.'},
            'notes': 'Player-visible note survives export.', 'dmNotes': 'SECRET MUST NEVER EXPORT',
            'vitality': {'max': 37, 'current': 2},
            'buBalance': {'progressionPool': 40, 'progressionSpent': 13, 'progressionRemaining': 27, 'itemBuSpent': 0},
            'pdfDerived': {'attributes': {'physical': -2, 'mental': 7, 'magical': 1},
                           'saves': {'physical': -2, 'mental': 10, 'magical': 4},
                           'pb': 3, 'dc': 19, 'restCap': 11, 'carryCapacity': 88, 'slotCapacity': 4,
                           'movement': {'walk': 45, 'swim': 10},
                           'practices': [{'practice': 'knowledge', 'total': 13, 'training': 2}]}}


class SnapshotTests(unittest.TestCase):
    def test_full_scope_contains_every_acquisition_and_every_authored_description(self):
        source = character(4)
        source['primitiveLinks'][0]['primitive'].update(mechanicalOutputText='Complete mechanical zero.',
            originalMechanicalOutputText='Complete mechanical zero.', verboseDescription='Complete verbose zero.',
            narrativeRule='Complete narrative zero.')
        source['primitiveLinks'][1]['primitive'].update(mechanicalOutputText='Effective mirrored rule.',
            originalMechanicalOutputText='Original standard rule.', narrativeRule='Full original narrative.')
        source['primitiveLinks'][2]['primitive']['category'] = 'DOMAIN'
        records = supporting_records(source, primitive_records(source))['full_rules']
        self.assertEqual([r['ref'] for r in records], ['P01','P02','P03','P04'])
        self.assertIn('Complete mechanical zero.', records[0]['body'])
        self.assertIn('Complete verbose zero.', records[0]['body'])
        self.assertIn('Complete narrative zero.', records[0]['body'])
        self.assertIn('Effective mirrored rule.', records[1]['body'])
        self.assertIn('Full original narrative.', records[1]['body'])
        self.assertIn('mirrored', records[1]['body'])
        self.assertNotIn('Original standard rule.', records[1]['body'])

    def test_debt_is_used_credit_not_the_entire_bracket_allowance(self):
        source = character()
        source['buBalance'].update(progressionSpent=47, progressionPool=40)
        source['volatility'] = {'rating':10,'ceiling':12,'levelBracket':'L9-L12'}
        self.assertEqual(debt_account(source), {'used':7,'available':3,'max':12,'bracket':'L9-L12'})
        source['buBalance']['progressionSpent'] = 20
        self.assertEqual(debt_account(source)['available'], 10)
        self.assertEqual(debt_account(source)['used'], 0)

    def test_full_scope_keeps_item_bound_ingredients_in_their_own_namespace(self):
        source = character(1)
        source['itemLinks'] = [{'item':{'id':'staff','name':'Staff','primitiveLinks':[
            {'primitiveId':77,'versionId':'item-pin','primitive':{'id':77,'name':'Item scope',
             'mechanicalOutputText':'Complete item mechanics.', 'narrativeRule':'Complete item narrative.',
             'verboseDescription':'Complete item verbose.'}}]}}]
        rows = primitive_records(source)
        scope = supporting_records(source,rows)['full_rules']
        self.assertEqual([r['ref'] for r in scope],['P01','I01.P01'])
        self.assertIn('Item-bound rule / I01.',scope[1]['body'])
        for text in ('Complete item mechanics.','Complete item narrative.','Complete item verbose.'):
            self.assertIn(text,scope[1]['body'])
        self.assertEqual(scope[1]['version_id'],'item-pin')
        self.assertEqual(len(rows),1)

    def test_markdown_is_formatted_and_authored_html_never_becomes_markup(self):
        rendered = markdown_html('## Clear title\n\n**Bold** and *italic*\n- One\n- Two\n\n'
                                 '[safe](https://example.com/rules?a=1&b=2)\n'
                                 '[unsafe](javascript:alert) <script>alert(1)</script>\n'
                                 '![image alt](https://example.com/remote.png)')
        self.assertIn('<b>Bold</b>', rendered)
        self.assertIn('<i>italic</i>', rendered)
        self.assertIn('• One<br/>• Two', rendered)
        self.assertIn('https://example.com/rules?a=1&amp;b=2', rendered)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;', rendered)
        self.assertNotIn('javascript:', rendered)
        self.assertNotIn('<img', rendered)
        self.assertNotIn('**', rendered)

    def test_derived_stats_never_depend_on_character_name_or_level(self):
        source = character()
        data = stats(source)
        self.assertEqual(data['dc'], 19)
        self.assertEqual(data['restCap'], 11)
        self.assertEqual(data['attributes']['physical'], -2)
        self.assertEqual(training_level({'pbContribution': 6}, 3), 2)

    def test_repeated_primitives_keep_occurrence_refs(self):
        source = character(3)
        source['primitiveLinks'][1]['primitive']['id'] = 0
        records = primitive_records(source)
        self.assertEqual([r['ref'] for r in records], ['P01', 'P02', 'P03'])
        self.assertTrue(records[1]['is_mirrored'])
        self.assertNotEqual(records[0]['instance_id'], records[1]['instance_id'])

    def test_player_notes_preserved_dm_notes_excluded(self):
        source = character()
        output = json.dumps(supporting_records(source, primitive_records(source)))
        self.assertIn('Player-visible', output)
        self.assertNotIn('SECRET MUST NEVER EXPORT', output)

    def test_invalid_options_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown'):
            validate_request({'character': {}, 'options': {'style': '../../unsafe'}})

    def test_access_recognizes_1d20_and_long_range(self):
        self.assertEqual(access_value({'name': 'Intensity 1d20', 'rule': 'Output 1d20.', 'category': 'INTENSITY_DICE'}), 'd20')
        self.assertEqual(access_value({'name': 'Very Far Range', 'rule': '', 'category': 'RANGE'}), 'Very Far')

    def test_conflicting_pins_survive_and_standard_refs_do_not_pick_mirrors(self):
        source = character(2)
        for index, link in enumerate(source['primitiveLinks']):
            link['versionId'] = 'primitive-v1'
            link['primitive']['id'] = 77
            link['primitive']['mechanicalOutputText'] = 'Subtract 2.' if index else 'Add 2.'
        source['capabilityLinks'] = [
            {'versionId': 'cap-v1', 'capability': {'id': 'same-cap', 'name': 'Two pins', 'verboseDescription': 'First authored rule.',
               'primitiveLinks': [{'primitiveId': 77, 'versionId': 'primitive-v1', 'isMirrored': False}],
               'effectLinks': [{'versionId': 'effect-v1', 'effect': {'id': 'same-effect', 'name': 'Two effects', 'description': 'First effect rule.'}}]}},
            {'versionId': 'cap-v2', 'capability': {'id': 'same-cap', 'name': 'Two pins', 'verboseDescription': 'Second authored rule.',
               'primitiveLinks': [{'primitiveId': 77, 'versionId': 'primitive-v1', 'isMirrored': True}],
               'effectLinks': [{'versionId': 'effect-v2', 'effect': {'id': 'same-effect', 'name': 'Two effects', 'description': 'Second effect rule.'}}]}},
        ]
        result = supporting_records(source, primitive_records(source))
        self.assertEqual(len(result['capabilities']), 2)
        self.assertEqual(len(result['effects']), 2)
        self.assertIn('First authored rule.', result['capabilities'][0]['body'])
        self.assertIn('Owned references: P01, E01.', result['capabilities'][0]['body'])
        self.assertNotIn('P02', result['capabilities'][0]['body'])
        self.assertIn('Owned references: P02, E02.', result['capabilities'][1]['body'])
        self.assertEqual({e['body'] for e in result['effects']}, {'First effect rule.', 'Second effect rule.'})

    def test_ambiguous_actual_matching_occurrences_keep_all_refs(self):
        source = character(3)
        for link in source['primitiveLinks']:
            link['isMirrored'] = False
            link['versionId'] = 'same-pin'
            link['primitive']['id'] = 99
        source['capabilityLinks'] = [{'capability': {'id': 'cap', 'name': 'Repeated ingredients',
                                     'primitiveLinks': [{'primitiveId': 99, 'versionId': 'same-pin'}]}}]
        result = supporting_records(source, primitive_records(source))
        self.assertIn('P01, P02, P03', result['capabilities'][0]['body'])

    def test_same_pin_with_different_effective_content_is_not_collapsed(self):
        source = character(0)
        source['capabilityLinks'] = [
            {'versionId': 'cap-pin', 'capability': {'id': 'cap', 'name': 'One source', 'verboseDescription': text}}
            for text in ('First effective definition.', 'Second effective definition.')]
        source['effectLinks'] = [
            {'versionId': 'effect-pin', 'effect': {'id': 'effect', 'name': 'One effect', 'description': text}}
            for text in ('First effective effect.', 'Second effective effect.')]
        result = supporting_records(source, primitive_records(source))
        self.assertEqual(len(result['capabilities']), 2)
        self.assertEqual(len(result['effects']), 2)
        self.assertEqual({row['body'] for row in result['effects']},
                         {'First effective effect.', 'Second effective effect.'})

    def test_references_choose_the_actual_pin_and_effective_rule(self):
        source = character(3)
        for index, link in enumerate(source['primitiveLinks']):
            link['primitive']['id'] = 55
            link['versionId'] = 'old-pin' if index == 0 else 'new-pin'
            link['isMirrored'] = index == 2
            link['primitive']['mechanicalOutputText'] = ['Old rule.', 'New rule.', 'Mirrored rule.'][index]
        source['capabilityLinks'] = [
            {'capability': {'id': 'new', 'name': 'Current pin', 'primitiveLinks': [
                {'primitiveId': 55, 'versionId': 'new-pin', 'isMirrored': False}]}},
            {'capability': {'id': 'unknown', 'name': 'Different effective rule', 'primitiveLinks': [
                {'primitiveId': 55, 'versionId': 'new-pin', 'primitive': {'mechanicalOutputText': 'Unowned rule.'}}]}}
        ]
        result = supporting_records(source, primitive_records(source))
        self.assertIn('Owned references: P02.', result['capabilities'][0]['body'])
        self.assertNotIn('P01', result['capabilities'][0]['body'])
        self.assertNotIn('P03', result['capabilities'][0]['body'])
        self.assertNotIn('Owned references:', result['capabilities'][1]['body'])

    def test_graph_item_fallback_uses_workspace_parent_child_edges(self):
        source = character(0)
        source['itemLinks'] = [{'quantity': 1, 'equipped': False, 'item': {'id': 'gear', 'name': 'Gear', 'size': 'SMALL', 'buCost': 1}}]
        source['readOnlyGraph'] = {
            'nodes': [{'id': 42, 'kind': 'primitive', 'name': 'Pinned item rule', 'description': 'Full item rule.'}],
            'edges': [{'parent': 'item:gear', 'child': 'primitive:42', 'isMirrored': False}]}
        result = supporting_records(source, primitive_records(source))
        self.assertIn('I01.P01 / Pinned item rule: Full item rule.', result['items'][0]['body'])


@unittest.skipUnless((ASSETS/'fonts/Aubrey.ttf').is_file() and (ASSETS/'styles/aegis/frame.png').is_file(), 'Durable PDF assets are not installed')
class NativePdfTests(unittest.TestCase):
    def test_practice_roll_marks_fit_all_twelve_styles_and_front_layouts(self):
        source = character(0)
        source['pdfDerived']['rollMarkers'] = {'skill_practice_check.'+practice: {
            'netAdvantage':2,'floor':100,'ceiling':999,'conditional':True}
            for _, practices in GROUPS for practice in practices}
        with tempfile.TemporaryDirectory() as directory:
            for style, *_ in STYLES:
                for orientation in ('portrait','landscape'):
                    for density in ('normal','compact'):
                        with self.subTest(style=style,orientation=orientation,density=density):
                            folio = RuntimeFolio(source,{'style':style,'orientation':orientation,
                                'density':density,'workbench':False},Path(directory)/'markers.pdf')
                            if orientation == 'landscape': folio.front_landscape(density)
                            else: folio.front_portrait(density)
                            folio.c.save()
                            self.assertEqual(len(folio.roll_annotations),40)
                            for mark in folio.roll_annotations:
                                practice = mark['target'].split('.')[-1]
                                pair = next(p for p in folio.metric_pairs if p['role']=='practice_'+practice)
                                left,top,right,bottom = mark['box']
                                card = pair['card']
                                self.assertGreaterEqual(left,card[0]+5)
                                self.assertLessEqual(right,card[2]-4)
                                self.assertGreaterEqual(top,card[1]+3)
                                self.assertLessEqual(bottom,card[3]-2)

    def test_full_scope_ink_roll_symbols_budget_and_removed_folio_survive_pdf(self):
        source = character(2)
        source['primitiveLinks'][0]['primitive'].update(
            mechanicalOutputText='mechanicalwitness is a complete mechanical rule.',
            originalMechanicalOutputText='mechanicalwitness is a complete mechanical rule.',
            verboseDescription='verbosewitness preserves the entire long authored description.',
            narrativeRule='narrativewitness preserves additional scope.')
        source['volatility'] = {'rating':10,'ceiling':12,'levelBracket':'L9-L12'}
        source['buBalance'].update(progressionSpent=47, progressionPool=40, progressionRemaining=-7, itemBuSpent=18)
        source['pdfDerived']['rollMarkers'] = {'skill_practice_check.knowledge': {
            'netAdvantage':2,'floor':10,'ceiling':20,'conditional':True}}
        with tempfile.TemporaryDirectory() as directory:
            for orientation in ('portrait','landscape'):
                for color in (False,True):
                    with self.subTest(orientation=orientation,color=color):
                        result = render({'character':source,'options':{'orientation':orientation,
                            'density':'compact','color':color,'workbench':True}}, Path(directory)/'proof.pdf')
                        pages = PdfReader(result['path']).pages
                        actual = ' '.join(p.extract_text() for p in pages)
                        for text in ('mechanicalwitness','verbosewitness','narrativewitness','Debt 7 used / 3 available / 12 max','Item BU 18'):
                            self.assertIn(text,actual)
                        self.assertNotIn('FOLIO',actual)
                        self.assertNotIn('ONGOING / DEFENCES',actual)
                        kinds = {m['kind'] for m in result['roll_annotations']}
                        self.assertEqual(kinds,{'advantage','floor','ceiling','conditional'})
                        with pdfplumber.open(result['path']) as pdf:
                            matched = []
                            for p in pdf.pages:
                                for char in p.chars:
                                    rgb = char['non_stroking_color']
                                    if color and rgb and len(rgb)==3 and all(abs(a-b)<.0001 for a,b in zip(rgb,(144/255,68/255,34/255))):
                                        matched.append(char)
                            if color:
                                self.assertIn('mechanicalwitness',''.join(c['text'] for c in matched))
                                self.assertTrue(all('Bold' in c['fontname'] for c in matched))

    def test_markdown_faces_preserve_reading_scale_advances_and_baseline(self):
        folio = RuntimeFolio(character(0), {'style': 'aegis', 'orientation': 'portrait',
                                          'density': 'normal', 'workbench': False}, Path('/unused.pdf'))
        normal = pdfmetrics.getFont('Body').face
        for name in ('BodyBold', 'BodyItalic', 'BodyBoldItalic'):
            face = pdfmetrics.getFont(name).face
            self.assertEqual(face.unitsPerEm, normal.unitsPerEm)
            self.assertEqual(face.ascent, normal.ascent)
            self.assertEqual(face.descent, normal.descent)
            for text in ('The exact same reading scale.', 'Bold +123 / -12', 'Italic emphasis'):
                self.assertAlmostEqual(pdfmetrics.stringWidth(text, name, 9.2),
                                       pdfmetrics.stringWidth(text, 'Body', 9.2))

    def test_markdown_and_sanitized_media_survive_native_pdf_pagination(self):
        png = BytesIO()
        image = Image.new('RGBA', (256, 256), (255, 0, 0, 0))
        ImageDraw.Draw(image).polygon([(20, 40), (220, 10), (250, 230), (35, 245)], fill=(40, 140, 220, 210))
        image.save(png, format='PNG')
        media = {'data': base64.b64encode(png.getvalue()).decode(), 'mimeType': 'image/png',
                 'credit': 'Witness icon by Test Author / game-icons.net / CC BY 3.0 / https://creativecommons.org/licenses/by/3.0/'}
        source = character(1)
        source['portraitFrame'] = {'x': 20, 'y': 80, 'zoom': 2}
        source['primitiveLinks'][0]['versionId'] = 'pinned-primitive'
        source['primitiveLinks'][0]['primitive']['narrativeRule'] = '**Strongrule** and *Italicrule*.\n\n- First list point\n- Second list point\n\n[Linked rule](https://example.com/actual-rule)'
        source['capabilityLinks'] = [{'versionId': 'pinned-cap', 'capability': {
            'id': 'cap', 'name': 'A real composition', 'verboseDescription': '### Named outcome\n\n**Exactcap**: unchanged meaning.'}}]
        source['effectLinks'] = [{'effect': {'id': 'effect', 'name': 'A reusable effect', 'description': 'An *exacteffect* rule.'}}]
        source['heritageLinks'] = [{'heritage': {'id': 'heritage', 'name': 'An illustrated heritage',
                                                'kind': 'MANIFEST', 'description': 'Heritage **fulltext** remains beside the illustration.'}}]
        source['itemLinks'] = [{'quantity': 1, 'item': {'id': 'item', 'name': 'An item', 'size': 'SMALL',
                                                       'buCost': 1, 'description': 'An **itemrule**.'}}]
        source['pdfMedia'] = {'character': media, 'heritages': {'heritage': media}, 'icons': {
            'primitive:0': dict(media, data='invalid-base64'),
            'primitive:0:pinned-primitive': media, 'capability:cap:pinned-cap': media,
            'effect:effect': media, 'item:item': media}}
        with tempfile.TemporaryDirectory() as directory:
            for orientation in ('portrait', 'landscape'):
                result = render({'character': source, 'options': {'orientation': orientation, 'density': 'compact'}},
                                Path(directory)/(orientation+'.pdf'))
                reader = PdfReader(result['path'])
                actual = '\n'.join(page.extract_text() for page in reader.pages)
                for word in ('Strongrule', 'Italicrule', 'Exactcap', 'exacteffect', 'fulltext', 'itemrule', 'Linked rule'):
                    self.assertIn(word, actual)
                self.assertNotIn('**', actual)
                self.assertNotIn('*Italicrule*', actual)
                self.assertTrue(any('**Strongrule**' in s['source_markdown'] for s in result['rule_segments']))
                self.assertTrue(all('**' not in s['rendered_text'] for s in result['rule_segments']))
                placements = result['media_placements']
                self.assertEqual(len([p for p in placements if p['key'].startswith('character:')]), 2)
                front_portrait = next(p for p in placements if p['role'] == 'character_portrait')
                self.assertEqual(front_portrait['portrait_frame'], source['portraitFrame'])
                self.assertIsNotNone(front_portrait['clip'])
                self.assertAlmostEqual(front_portrait['draw_box'][0], front_portrait['box'][0]-5.2)
                self.assertAlmostEqual(front_portrait['draw_box'][1], front_portrait['box'][1]-26.8)
                self.assertTrue(all(p['portrait_frame'] is None for p in placements if p['role'] == 'character_identity_portrait'))
                self.assertTrue(any(p['role'] == 'character_portrait' and p['page'] == 1 for p in placements))
                self.assertTrue(any(p['role'] == 'heritage_portrait' for p in placements))
                for kind in ('primitive:0:pinned-primitive', 'capability:cap:pinned-cap', 'effect:effect', 'item:item'):
                    self.assertTrue(any(p['key'] == kind and p['role'] == 'entity_icon' for p in placements), kind)
                self.assertEqual(result['media_decode_failures'], 0)
                self.assertIn('SwordWeave-image-and-icon-credits.txt', reader.attachments)
                self.assertIn(b'Test Author', reader.attachments['SwordWeave-image-and-icon-credits.txt'][0])
                urls = [str(annotation.get_object().get('/A', {}).get('/URI', ''))
                        for page in reader.pages for annotation in page.get('/Annots', [])]
                self.assertIn('https://example.com/actual-rule', urls)
                with pdfplumber.open(result['path']) as pdf:
                    for placed in placements:
                        left, top, right, bottom = placed['draw_box']
                        if placed['clip']:
                            left, top = max(left, placed['box'][0]), max(top, placed['box'][1])
                            right, bottom = min(right, placed['box'][2]), min(bottom, placed['box'][3])
                        for glyph in pdf.pages[placed['page']-1].chars:
                            overlap_x = min(right, glyph['x1'])-max(left, glyph['x0'])
                            overlap_y = min(bottom, glyph['bottom'])-max(top, glyph['top'])
                            self.assertFalse(overlap_x > .2 and overlap_y > .2, (placed, glyph))
                for page in reader.pages:
                    for ref in page['/Resources'].get('/XObject', {}).values():
                        obj = ref.get_object()
                        if obj.get('/Subtype') == '/Image':
                            self.assertEqual(obj.get('/ColorSpace'), '/DeviceGray')

    def test_metric_pairs_stay_adjacent_and_inside_every_style_card(self):
        """Check real embedded-font glyphs, not merely intended anchor points."""
        with tempfile.TemporaryDirectory() as directory:
            for style, *_ in STYLES:
                for orientation in ('portrait', 'landscape'):
                    for density in ('normal', 'compact'):
                        for total in (1, -12, 123):
                            with self.subTest(style=style, orientation=orientation, density=density, total=total):
                                source = character(0)
                                source['pdfDerived']['saves'] = {key: total for key in ('physical', 'mental', 'magical')}
                                source['pdfDerived']['practices'] = [
                                    {'practice': practice, 'total': total, 'training': 1}
                                    for _, practices in GROUPS for practice in practices]
                                folio = RuntimeFolio(source, {'style': style, 'orientation': orientation,
                                                              'density': density, 'workbench': False},
                                                     Path(directory)/'metrics.pdf')
                                # The actual front methods include the approved style's
                                # card outlines and all normal/compact placement paths.
                                if orientation == 'landscape':
                                    folio.front_landscape(density)
                                else:
                                    folio.front_portrait(density)
                                folio.c.save()
                                self.assertEqual(len(folio.metric_pairs), 13)
                                with pdfplumber.open(BytesIO(folio.stream.getvalue())) as pdf:
                                    chars = pdf.pages[0].chars
                                    for pair in folio.metric_pairs:
                                        left, top, right, bottom = pair['value_box']
                                        glyphs = [char for char in chars
                                                  if char['x0'] >= left-.02 and char['x1'] <= right+.02
                                                  and abs(char['top']-top) < 3]
                                        self.assertEqual(''.join(c['text'] for c in glyphs), f'{total:+}', pair)
                                        actual_left = min(c['x0'] for c in glyphs)
                                        actual_right = max(c['x1'] for c in glyphs)
                                        card = pair['card']
                                        cell = pair['cell']
                                        label = pair['label_box']
                                        self.assertGreaterEqual(actual_left, cell[0]+1.9, pair)
                                        self.assertLessEqual(actual_right, cell[2]-1.9, pair)
                                        self.assertGreaterEqual(actual_left, card[0]+6, pair)
                                        self.assertLessEqual(actual_right, card[2]-6, pair)
                                        # A consistent centered cell immediately follows a
                                        # measured label column. No large empty gulf remains.
                                        self.assertGreaterEqual(actual_left-label[2], 3.9, pair)
                                        self.assertLessEqual(actual_left-label[2], 28, pair)
                                        self.assertAlmostEqual((actual_left+actual_right)/2,
                                                               (cell[0]+cell[2])/2, places=2)
                                        self.assertTrue(all(c['top'] >= card[1]+3 and c['bottom'] <= card[3]-3
                                                            for c in glyphs), pair)

    def test_large_ledgers_continue_without_tiny_type_or_lost_occurrences(self):
        with tempfile.TemporaryDirectory() as directory:
            for count, orientation in ((80, 'portrait'), (120, 'landscape')):
                source = character(count)
                source['capabilityLinks'] = [{'capability': {
                    'id': f'cap-{i}', 'name': f'Composition witness {i}',
                    'verboseDescription': f'compositiontoken{i} uses the agreed owned ingredients.'}}
                    for i in range(20)]
                result = render({'character': source, 'options': {
                    'orientation': orientation, 'density': 'auto', 'workbench': True}},
                    Path(directory)/f'{orientation}.pdf')
                self.assertEqual(result['chosen_density'], 'compact')
                self.assertEqual(len(result['primitive_records']), count)
                self.assertGreater(result['pages'], 3)
                actual = re.sub(r'\s+', ' ', ' '.join(p.extract_text() for p in PdfReader(result['path']).pages))
                for i in range(count):
                    self.assertIn(f'A uniquely numbered rule {i} changes', actual)
                for i in range(20):
                    self.assertIn(f'compositiontoken{i}', actual)
                for segment in result['rule_segments']:
                    painted = [t for t in result['text_boxes']
                               if t['page'] == segment['page'] and t['box'] == segment['box']]
                    self.assertTrue(painted, segment['ref'])
                    self.assertTrue(all(t['size'] >= 9.2 for t in painted))

    def test_auto_density_and_unabridged_oversized_rule_progress(self):
        with tempfile.TemporaryDirectory() as directory:
            source = character(3, True)
            result = render({'character': source, 'options': {'density': 'auto', 'workbench': False}}, Path(directory)/'large.pdf')
            self.assertEqual(result['chosen_density'], 'compact')
            self.assertGreater(result['pages'], 2)
            segments = [s for s in result['rule_segments'] if s['ref'] == 'P01']
            self.assertGreater(len(segments), 1)
            text = ' '.join(page.extract_text() for page in PdfReader(result['path']).pages)
            words = set(re.findall(r'paragraphword\d+', text))
            self.assertEqual(words, {f'paragraphword{i}' for i in range(3000)})
            self.assertNotIn('SECRET MUST NEVER EXPORT', text)
            values = {v['role']: v['value'] for v in result['numeric_values']}
            self.assertEqual(values['attribute_physical'], '-2')
            self.assertEqual(values['dc'], '19')
            self.assertEqual(values['rest_cap'], '11')
            self.assertTrue(any(f['role'] == 'current_vitality' for f in result['writing_fields']))

    def test_landscape_is_native_two_panel_geometry(self):
        with tempfile.TemporaryDirectory() as directory:
            result = render({'character': character(8), 'options': {'orientation': 'landscape', 'density': 'normal', 'workbench': True}}, Path(directory)/'fold.pdf')
            fold_left, fold_right = result['fold_gutter']
            for box in result['text_boxes'] + result['writing_fields']:
                x, y, right, bottom = box['box']
                self.assertTrue(right <= fold_left or x >= fold_right, box)
                self.assertGreaterEqual(y, 0)
                self.assertLessEqual(bottom, result['page_size'][1]-30, box)
            self.assertEqual(result['roles'][0]['panel'], 0)
            self.assertEqual(result['roles'][1]['panel'], 1)
            # Declaring scale shares the core half; the other half is an
            # uninterrupted ingredient ledger through the lower writing area.
            intent = [choice for choice in result['choices']
                      if choice['family'].startswith('intent_') and choice['page'] == 1]
            self.assertTrue(intent)
            self.assertTrue(all(choice['page'] == 1 and choice['panel'] == 0 for choice in intent))
            first_rules = [row for row in result['rule_segments'] if row['page'] == 1]
            self.assertTrue(all(row['panel'] == 1 for row in first_rules))
            sizes = {round(t['size'], 1) for t in result['text_boxes'] if t.get('paragraph')}
            self.assertIn(9.2, sizes)
            self.assertTrue(all(float(p.mediabox.width) > float(p.mediabox.height) for p in PdfReader(result['path']).pages))

    def test_landscape_front_has_concept_and_full_identity_remains_readable(self):
        with tempfile.TemporaryDirectory() as directory:
            source = character(0)
            source['concept'] = ' '.join(f'conceptword{i}' for i in range(80))
            source['heritageLinks'] = [{'heritage': {'id': 'heritage', 'name': 'The Long Remembered Heritage',
                                        'kind': 'MANIFEST', 'description': 'Complete heritage narrative.'}}]
            result = render({'character': source, 'options': {'orientation': 'landscape', 'workbench': False}}, Path(directory)/'identity.pdf')
            reader = PdfReader(result['path'])
            self.assertIn('CONCEPT / HERITAGES', reader.pages[0].extract_text())
            text = ' '.join(page.extract_text() for page in reader.pages)
            for index in range(80):
                self.assertIn(f'conceptword{index}', text)
            self.assertIn('The Long Remembered Heritage', text)
            self.assertIn('Complete heritage narrative.', text)


if __name__ == '__main__':
    unittest.main()
