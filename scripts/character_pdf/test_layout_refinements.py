"""Table-use contracts: prioritization, references, writable totals and larger art."""
import base64
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image
from pypdf import PdfReader
from character_pdf.renderer import render, primitive_records, supporting_records
from character_pdf.test_renderer import character


class ReferencesTests(unittest.TestCase):
    def test_effects_reference_matching_acquisitions_and_nested_effects(self):
        source = character(2)
        for index, link in enumerate(source['primitiveLinks']):
            link.update(versionId=f'pin-{index}', isMirrored=False)
            link['primitive']['id'] = 12
        child = {'id': 'child', 'name': 'Child effect', 'description': 'The child outcome.'}
        parent = {'id': 'parent', 'name': 'Parent effect', 'description': 'The parent outcome.',
                  'primitiveLinks': [{'primitiveId': 12, 'versionId': 'pin-1'}],
                  'effectLinks': [{'effect': child}]}
        source['effectLinks'] = [{'effect': parent}]
        records = supporting_records(source, primitive_records(source))
        self.assertEqual([row['ref'] for row in records['effects']], ['E01', 'E02'])
        self.assertIn('Owned references: P02, E02.', records['effects'][0]['body'])
        self.assertNotIn('P01', records['effects'][0]['body'])
        self.assertIn('The parent outcome.', records['effects'][0]['body'])
        self.assertEqual(len(primitive_records(source)), 2)

    def test_item_effect_ingredients_keep_the_item_acquisition_namespace(self):
        source = character(0)
        ingredient = {'id': 73, 'name': 'Shield brace', 'mechanicalOutputText': 'Brace the named threshold.'}
        effect = {'id': 'brace', 'name': 'Braced passage', 'description': 'The doorway is supported.',
                  'primitiveLinks': [{'primitive': ingredient}]}
        source['itemLinks'] = [{'item': {'id': 'shield', 'name': 'Shield',
                              'primitiveLinks': [{'primitive': ingredient}],
                              'effectLinks': [{'effect': effect}]}}]
        records = supporting_records(source, primitive_records(source))
        self.assertIn('Owned references: I01.P01.', records['effects'][0]['body'])
        self.assertIn('I01.P01 / Shield brace', records['items'][0]['body'])
        self.assertEqual(primitive_records(source), [])


class TableUseTests(unittest.TestCase):
    def test_front_prioritizes_narrative_then_active_then_conditional_then_passive_without_renumbering(self):
        source = character(4)
        for link in source['primitiveLinks']:
            link['isMirrored'] = False
            link['primitive']['mechanicalOutputText'] = 'A stable authored rule.'
        source['primitiveLinks'][0]['primitive']['hardModifiers'] = [{'kind': 'modify', 'operation': 'add', 'target': 'physical', 'value': 3}]
        source['primitiveLinks'][1]['primitive']['hardModifiers'] = [{'kind': 'modify', 'operation': 'add', 'target': 'physical', 'value': 2,
                                                                   'condition': {'kind': 'tags', 'customTags': ['holding gate']}}]
        source['primitiveLinks'][2]['primitive']['hardModifiers'] = [{'kind': 'modify', 'operation': 'grant', 'target': 'behavior:flight', 'value': 1}]
        # The server projects a narrative fallback into mechanicalOutputText;
        # its original authored field is the meaningful distinction.
        source['primitiveLinks'][3]['primitive']['originalMechanicalOutputText'] = ''
        with tempfile.TemporaryDirectory() as directory:
            result = render({'character': source, 'options': {'density': 'compact'}}, Path(directory)/'order.pdf')
            self.assertEqual(result['front_order'], ['P04', 'P03', 'P02', 'P01'])
            self.assertEqual([row['ref'] for row in result['primitive_records']], ['P01', 'P02', 'P03', 'P04'])
            actual = [row['ref'] for row in result['rule_segments'] if row['area'] == 'primitive_rules' and not row['continued']]
            self.assertEqual(actual[:4], result['front_order'])

    def test_current_totals_full_movement_and_large_portraits_survive_both_layouts(self):
        source = character(10)
        source['pdfDerived'].update(equippedSlotsUsed=7, currentLoad=9,
                                    movement={'walk': 45, 'climb': 20, 'swim': 15, 'burrow': 5, 'fly': 60})
        source['itemLinks'] = [{'quantity': 3, 'equipped': True, 'load': 9, 'equippedSlotCost': 7,
                                'item': {'id': 'kit', 'name': 'The printed kit', 'size': 'SMALL', 'buCost': 2}}]
        source['heritageLinks'] = [{'heritage': {'id': 'heritage', 'name': 'The pictured heritage', 'description': 'A complete heritage rule.'}}]
        image = Image.new('RGBA', (512, 512), (30, 90, 150, 255)); png = BytesIO(); image.save(png, format='PNG')
        media = {'mimeType': 'image/png', 'data': base64.b64encode(png.getvalue()).decode()}
        source['pdfMedia'] = {'character': media, 'heritages': {'heritage': media}, 'icons': {}}
        with tempfile.TemporaryDirectory() as directory:
            for orientation in ('portrait', 'landscape'):
                result = render({'character': source, 'options': {'density': 'normal', 'orientation': orientation, 'workbench': True}},
                                Path(directory)/(orientation+'.pdf'))
                actual = ' '.join(page.extract_text() for page in PdfReader(result['path']).pages)
                for movement in ('Walk 45', 'Climb 20', 'Swim 15', 'Burrow 5', 'Flight 60'):
                    self.assertIn(movement, actual)
                for role, expected in (('slots_used', '7'), ('slots_current', '7'), ('load_current', '9')):
                    values = [value for value in result['numeric_values'] if value['role'] == role]
                    self.assertTrue(values, role)
                    for value in values:
                        self.assertEqual(value['value'], expected)
                        matching = [field for field in result['writing_fields'] if field['page'] == value['page'] and field['panel'] == value['panel'] and field['role'] == role]
                        self.assertTrue(any(f['box'][0] <= value['box'][0] <= value['box'][2] <= f['box'][2]
                                            and f['box'][1] <= value['box'][1] <= value['box'][3] <= f['box'][3] for f in matching))
                portraits = [p for p in result['media_placements'] if p['role'] in ('heritage_portrait', 'character_identity_portrait')]
                self.assertEqual(len(portraits), 2)
                self.assertTrue(all(p['box'][2]-p['box'][0] >= 99.9 for p in portraits))
                support = [s for s in result['rule_segments'] if s['area'] == 'identity and notes']
                self.assertLess(min(s['box'][1] for s in support), 150)
                if orientation == 'landscape':
                    self.assertAlmostEqual(result['fold_gutter'][1]-result['fold_gutter'][0], 16)
                    first = [s for s in result['rule_segments'] if s['page'] == 1]
                    self.assertEqual(len({round(s['box'][0], 2) for s in first}), 2)
                    self.assertTrue(all(s['panel'] == 1 for s in first))


if __name__ == '__main__':
    unittest.main()
