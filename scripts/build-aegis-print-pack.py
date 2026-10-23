#!/usr/bin/env python3
"""Build a public Aegis print pack from the current, reviewed native renderer.

No application, database or source character is changed. Supply public-only
Tarn/Orren snapshots produced by loadCharacterPdfSnapshot(id, null).
"""
import argparse
from io import BytesIO
import hashlib
import json
from pathlib import Path
import sys
import zipfile


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--renderer-root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--snapshots', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--review', type=Path, required=True)
    parser.add_argument('--color', action='store_true', help='Gold/teal Aegis edition')
    parser.add_argument('--zip-filename', default='swordweave-aegis-character-sheets-v0.1-alpha.zip')
    args = parser.parse_args()
    edition = 'Gold / teal color' if args.color else 'Monochrome'
    sys.path.insert(0, str(args.renderer_root / 'scripts'))
    from character_pdf.renderer import RuntimeFolio, render, ASSETS
    from pypdf import PdfReader, PdfWriter

    class BlankFolio(RuntimeFolio):
        def __init__(self, options, output, supporting=False):
            super().__init__({'id': 'blank-template', 'name': '____________________',
                'concept': '____________________', 'primitiveLinks': [],
                'pdfDerived': {}, 'buBalance': {}}, options, output)
            self.supporting = supporting

        def text(self, value, *pos, **kw):
            value = str(value).replace('?', '___').replace('None recorded', '____________________')
            return super().text(value, *pos, **kw)

        def plain(self, value, *pos, **kw):
            return super().plain(str(value).replace('?', '___'), *pos, **kw)

        def value(self, value, *pos, **kw):
            return super().value('__' if value == '?' else value, *pos, **kw)

        def supporting_section(self, *unused):
            pass

        def equipment_pages(self):
            pass

        def front_portrait(self, density):
            if not self.supporting:
                return super().front_portrait(density)
            self.primitive_overflow()
            self.capabilities()
            self.equipment()
            self.identity_page()
            self.continuation()
            self.workbench_runtime()

        def lines(self, x, top, width, bottom, role, gap=18):
            for y in range(int(top), int(bottom), gap):
                self.write(x, y, width, gap-1, role)

        def support_panel(self, role, title, hint):
            self.begin('blank ' + role, title.upper())
            self.heading(title)
            self.band(title.upper(), self.left, 157, self.right-self.left, True)
            self.plain(hint, self.left+4, 183, self.right-self.left-8, 9.2, 11.2)

        def front_landscape(self, density):
            if not self.supporting:
                return super().front_landscape(density)
            x, w = self.left, self.right-self.left
            self.support_panel('primitive continuation', 'Owned ingredients',
                'Keep the same P references. Record the actual rule, its limits and how it ends.')
            self.text('REF', x+4, 223, 6.5, 'Head')
            self.text('NAME / RULE / LIMITS / ENDING', x+45, 223, 6.5, 'Head')
            self.line(x+35, 240, x+35, 537, .65, .35)
            self.lines(x+5, 242, 25, 535, 'primitive_ref', 18)
            self.lines(x+42, 242, w-47, 535, 'primitive_rule', 18)
            self.end()

            self.support_panel('capabilities and effects', 'Compositions & effects',
                'Name the composition; reuse owned references. State the outcome, Cost, limits and ending.')
            for i in range(4):
                y = 228+i*76
                self.text(('CAPABILITY' if i < 2 else 'EFFECT') + ' / REF', x+4, y, 6.5, 'Head')
                self.write(x+113, y-4, w-119, 15, 'composition_reference')
                self.lines(x+5, y+22, w-10, y+64, 'composition_rule', 18)
            self.end()

            self.support_panel('equipment', 'Carried & equipped',
                'Character BU and Item BU are separate. Record quantities, Load, slots and item-only rules.')
            starts = [0, 20, 188, 224, 262, 302]
            for offset, label in zip(starts, ['EQ', 'ITEM / REF', 'QTY', 'LOAD', 'SLOTS', 'ITEM BU']):
                self.text(label, x+offset+2, 222, 6.1, 'Head')
            for i in range(11):
                y = 244+i*18
                self.check(x+3, y, '', 'equipped', False)
                for j in range(1, len(starts)):
                    end = starts[j+1]-3 if j+1 < len(starts) else w-3
                    self.write(x+starts[j]+2, y-2, end-starts[j]-2, 16, 'item_'+str(j))
            self.band('ITEM / SOURCE / ACTUAL RULE / ENDING', x, 448, w, True)
            self.lines(x+5, 478, w-10, 540, 'item_rule', 18)
            self.end()

            self.support_panel('identity', 'Concept & story',
                'Combine the origins that fit your idea. A personal flaw alone grants no automatic BU.')
            self.band('CONCEPT / HERITAGES / UPBRINGINGS', x, 223, w, True)
            self.lines(x+5, 253, w-10, 292, 'concept_heritages', 18)
            self.band('ORIGIN / MOTIVATION / TIES', x, 306, w, True)
            self.lines(x+5, 336, w-10, 394, 'backstory', 18)
            self.band('DRAWBACK / ACTUAL RULE / ENDING', x, 412, w, True)
            self.lines(x+5, 442, w-10, 482, 'drawback', 18)
            self.text('LEVEL / CHARACTER BU / SEPARATE ITEM BU', x+4, 504, 6.3, 'Head')
            self.write(x+5, 524, w-10, 18, 'build_account')
            self.end()

            self.support_panel('full rule continuation', 'Full rules / continued',
                'Preserve the full actual rule. Continue onto another leaf instead of dropping its limits.')
            self.text('OWNER / SOURCE', x+5, 222, 6.5, 'Head')
            for i, label in enumerate(['Character', 'Item', 'Other']):
                self.check(x+109+i*77, 218, label, 'rule_owner', False, 8.5, meaning='intent')
            self.lines(x+5, 253, w-10, 540, 'full_rule_continuation', 18)
            self.end()

            self.support_panel('workbench', 'In-play workbench',
                'Compose with owned ingredients. Record new acquisitions separately when the table agrees.')
            self.band('INTENT / OWNED REFS / COST / ENDING', x, 223, w, True)
            self.lines(x+5, 253, w-10, 342, 'in_play_composition', 18)
            self.band('NEW PRIMITIVE / ACTUAL RULE / BU / SOURCE', x, 360, w, True)
            self.lines(x+5, 390, w-10, 480, 'new_acquisition', 18)
            for i, label in enumerate(['BU before', 'Spent', 'Left']):
                xx = x+4+i*114
                self.text(label, xx, 505, 8.3, 'Body')
                self.write(xx, 523, 93, 19, 'budget_'+str(i))
            self.end()

    args.output.mkdir(parents=True, exist_ok=True)
    args.review.mkdir(parents=True, exist_ok=True)
    files = []

    def save_result(result, ident, label, group):
        if group.startswith('blank-'):
            # A blank template has no character sources. Runtime's empty
            # snapshot helper still creates identity/budget placeholders;
            # those are not authored rules rendered by this template.
            result['source_records'] = {}
        path = Path(result['path'])
        writer = PdfWriter()
        writer.clone_document_from_reader(PdfReader(path))
        writer.add_metadata({'/Title': f'SwordWeave / Aegis / {edition} / {label} / v0.1 alpha',
                             '/Author': 'Marius Ion (Mashu)',
                             '/Subject': 'Printable character-sheet '+('example' if group == 'example' else 'blank template'),
                             '/Creator': 'SwordWeave'})
        writer.add_attachment('SwordWeave-print-pack-notices.txt', (
            'SwordWeave / Aegis / v0.1 alpha\nCreated by Marius Ion (Mashu).\n'
            'Keep a copy, print for your table and share these complete free sheets with friends.\n'
            'Printable pencil-and-paper PDF; no interactive form fields.\n'
            'Original game text: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/\n'
            'Artwork, branding, fonts and icons retain their separate notices.\n'
            f'AI-generated illustrations: OpenAI image tools under Marius Ion\'s direction; {"source color preserved" if args.color else "rendered in grayscale"}.\n'
            'Font notices and any used image/icon credits are attached to this PDF.\n'
            'This does not grant a standalone artwork or trademark license.\n'
            'https://www.swordweave.quest/books#character-sheets\n'
            'https://www.swordweave.quest/contact\n').encode())
        with path.open('wb') as stream:
            writer.write(stream)
        result['sha256'] = sha(path)
        manifest = args.review / (ident+'.json')
        manifest.write_text(json.dumps(result, indent=2)+'\n')
        files.append({'id': ident, 'label': label, 'group': group,
            'filename': Path(result['path']).name, 'pages': result['pages'],
            'bytes': Path(result['path']).stat().st_size, 'sha256': result['sha256'],
            'manifest': str(manifest)})

    for orientation in ('portrait', 'landscape'):
        for density in ('normal', 'compact'):
            ident = f'aegis-blank-{orientation}-'+('dense' if density == 'compact' else 'normal')
            options = {'style': 'aegis', 'orientation': orientation, 'density': density, 'workbench': False, 'color': args.color}
            result = BlankFolio(options, args.output/(ident+'.pdf')).generate()
            save_result(result, ident, f'{orientation.title()} - '+('Dense' if density == 'compact' else 'Normal'), 'blank-front')
        ident = f'aegis-blank-supporting-{orientation}'
        options = {'style': 'aegis', 'orientation': orientation, 'density': 'normal', 'workbench': False, 'color': args.color}
        result = BlankFolio(options, args.output/(ident+'.pdf'), supporting=True).generate()
        save_result(result, ident, f'Blank supporting pages - {orientation}', 'blank-support')

    examples = {}
    for key, orientation, density in [('tarn', 'portrait', 'normal'), ('orren', 'landscape', 'compact')]:
        source = json.loads((args.snapshots/(key+'-public-snapshot.json')).read_text())
        assert source['viewerPermission'] == 'VIEWER' and not source.get('notes') and not source.get('dmNotes')
        assert not source['buBalance']['overBudget']
        assert source['level'] == (1 if key == 'tarn' else 16)
        examples[key] = source
        ident = 'aegis-example-'+key
        result = render({'character': source, 'options': {'style': 'aegis', 'orientation': orientation,
                        'density': density, 'workbench': False, 'color': args.color}}, args.output/(ident+'.pdf'))
        save_result(result, ident, source['name']+f" - level {source['level']} example", 'example')

    readme = f'''SwordWeave - Aegis character-sheet print pack
v0.1 alpha / 23 October 2026 / refreshed from generator release ef2ceb3f
{edition} edition

The standard individual downloads and complete pack use the gold/teal color
edition. The separate monochrome ZIP provides the same sheets for economical
printing. Other styles and personalized sheets are in the website generator.

START HERE
Choose ONE blank front: portrait normal, portrait dense, landscape normal,
or landscape dense. Then print only the matching supporting leaves you need.
The supporting PDFs include primitives, compositions/reusable effects,
equipment/item rules, identity/story, full-rule continuation and a workbench.
Repeat a supporting leaf whenever you need more space. Reuse the same P/C/E/I
references across leaves; writing a reference does not purchase it again.

PRINTING
A4 portrait fronts are one page. A4 landscape fronts have two separately
composed halves, with two primitive columns in BOTH normal and dense formats.
Print landscape at 100% / actual size and fold through the protected 16 pt
centre clearance. Matching landscape supporting pages also fold centrally.
Review your printer preview before printing: scaling to Fit changes the size.
These are printable pencil-and-paper sheets, NOT interactive fillable PDFs.
All numerical values and ownership choices on the blank sheets are empty.

EXAMPLES
Tarn Emberpost is a level-one public demonstration character: portrait normal,
{examples['tarn']['buBalance']['progressionSpent']} of {examples['tarn']['buBalance']['progressionPool']} Character BU, separate Item BU. Orren Vaultwright is a level-sixteen
public demonstration: landscape dense, {examples['orren']['buBalance']['progressionSpent']} of {examples['orren']['buBalance']['progressionPool']} Character BU. Their full
owned rules and continuation references are included, rather than only a
front-page summary. Current tracking fields remain available for pencil.
These are existing example records, not independent playtest endorsements.

The supplied sheets passed digital layout, font, content and fold-gutter checks.
A physical printer, pencil and fold proof remains pending. This alpha may change.

WEBSITE AND RULES
https://www.swordweave.quest/books#character-sheets
https://www.swordweave.quest/rules
https://www.swordweave.quest/character
https://www.swordweave.quest/characters/aae2fea8-e17b-4887-afbe-a59bea94ad97?view=public
https://www.swordweave.quest/characters/1da4e351-da76-4822-bf1f-632d2e657145?view=public

Created by Marius Ion (Mashu). Keep a copy, print it for your table and share
these complete, free sheets with friends. Support is optional:
https://buymeacoffee.com/mashhul

Designated original game text uses CC BY 4.0; software uses MIT. Artwork,
branding, fonts and icons retain their separate notices. These print files
do not grant a standalone artwork or trademark license. See CREDITS.txt,
the font notices and any image/icon notices attached to the example PDFs.

CONTENTS / {edition}
'''+''.join(f"{file['filename']} - {file['pages']} page(s), {file['bytes']:,} bytes\n" for file in files)
    (args.output/'READ-ME.txt').write_text(readme)
    (args.output/'CREDITS.txt').write_text(f'''SwordWeave / Aegis print pack / {edition}
Created by Marius Ion (Mashu).
AI-generated frame, character and heritage illustrations were created with
OpenAI image-generation tools under Marius Ion's direction. Original Aegis
frames retain their native transparency. {"The renderer applies the approved simulated gold/teal/silver palette and preserves source illustration color." if args.color else "Print rendering converts artwork to grayscale."}
No new artwork was generated for this pack. Metallic appearance is simulated
with process color, not foil or metallic ink.

Aubrey, Syne, Unica One and Oxanium retain their embedded OFL notices.
Game-icons.net artwork retains its source authors and CC BY 3.0 notices;
the exact used image/icon credits are attached to each example PDF.

Original rules/explanatory game text: CC BY 4.0.
https://creativecommons.org/licenses/by/4.0/
Software: https://github.com/MashhuMaximilian/SwordWeave/blob/main/LICENSE
For asset reuse not covered by the existing notices:
https://www.swordweave.quest/contact
''')
    archive = args.output/args.zip_filename
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for file in files:
            folder = '01-blank-fronts' if file['group'] == 'blank-front' else '02-supporting-pages' if file['group'] == 'blank-support' else '03-filled-examples'
            z.write(args.output/file['filename'], folder+'/'+file['filename'])
        for name in ('READ-ME.txt', 'CREDITS.txt'):
            z.write(args.output/name, name)
        for name in ('Aubrey', 'Syne', 'UnicaOne', 'Oxanium'):
            z.write(ASSETS/'fonts'/(name+'-OFL.txt'), 'font-notices/'+name+'-OFL.txt')
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert len([n for n in z.namelist() if n.endswith('.pdf')]) == 8
        for file in files:
            member = next(n for n in z.namelist() if n.endswith('/'+file['filename']))
            assert hashlib.sha256(z.read(member)).hexdigest() == file['sha256']
    manifest = {'release': 'v0.1-alpha', 'updated': '2026-10-23', 'style': 'Aegis',
        'color': args.color, 'edition': edition, 'printable': True, 'fillable': False, 'physicalProof': 'pending', 'files': files,
        'zip': {'filename': archive.name, 'bytes': archive.stat().st_size, 'sha256': sha(archive)},
        'renderer': {str(p.relative_to(args.renderer_root)): sha(p) for p in
            [args.renderer_root/'scripts/character_pdf/renderer.py', args.renderer_root/'scripts/character_pdf/design.py', args.renderer_root/'scripts/character_pdf/theme.py', args.renderer_root/'scripts/character_pdf/markdown.py']},
        'source_snapshots': {key: sha(args.snapshots/(key+'-public-snapshot.json')) for key in examples}}
    (args.review/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({'pdfs': len(files), 'pages': sum(f['pages'] for f in files),
                      'zip': str(archive), 'bytes': archive.stat().st_size}))


if __name__ == '__main__':
    main()
