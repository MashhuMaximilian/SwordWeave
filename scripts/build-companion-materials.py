#!/usr/bin/env python3
"""Build original, interactive alpha companions from their checked public sources.

Run scripts/export-companion-source.ts with tsx first. Use the bundled Python
runtime (reportlab/pypdf). For uncached OFL WOFF2 conversion, use fontTools in
the current interpreter or, if available, the system PATH python3. This supports
the bundled PDF runtime and separately installed fontTools without installs.
Use --font-dir tmp/pdfs/fonts-clean-review to exercise an empty font cache.
No network or DB access.
"""
from pathlib import Path
from html import escape
import argparse
from hashlib import sha256
import json
import shutil
import subprocess
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf'
# Separate cache version preserves legacy companions' fonts for comparison.
FONT_DIR = ROOT / 'tmp/pdfs/companion-fonts-source-time-v1'
WIDTH, HEIGHT = A4
MARGIN = 39
CONTENT = WIDTH - MARGIN * 2
PAPER = colors.HexColor('#f8f3e7')
INK = colors.HexColor('#173331')
TEAL = colors.HexColor('#1e706a')
GOLD = colors.HexColor('#876323')
RULE = colors.HexColor('#adbcb0')
PANEL = colors.HexColor('#e9eadc')
DEEP_TEAL = colors.HexColor('#102c30')
PALE_GOLD = colors.HexColor('#e9c574')
FIELD = colors.HexColor('#fffdf7')
GOLD_STOPS = ('#87632b', '#c5a45e', '#f0d99b', '#b9944f', '#87632b')
SILVER_STOPS = ('#637b80', '#bacdca', '#f2f2df', '#96b1b0', '#637b80')
ASSET_DIR = ROOT / 'scripts/companion-assets'
SITE = 'https://www.swordweave.quest'


def metallic_rule(c, x, y, width, height=.65, stops=GOLD_STOPS):
    """Native simulated-metal shading, from the accepted PHB graphic vocabulary.

    Stops and clipping method: scripts/phb_art_edition_graphics.py in the
    accepted Interwoven production source. No reflective-foil finish is implied.
    """
    c.saveState()
    path = c.beginPath()
    path.rect(x, y, width, height)
    c.clipPath(path, stroke=0, fill=0)
    c.linearGradient(x, y, x + width, y,
                     [colors.HexColor(value) for value in stops], extend=True)
    c.restoreState()


def terminal(c, x, y, size=2.2):
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(.45)
    path = c.beginPath()
    path.moveTo(x, y + size)
    for point in ((x + size, y), (x, y - size), (x - size, y)):
        path.lineTo(*point)
    path.close()
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()


def prepare_fonts(font_dir=FONT_DIR):
    names = [('SwordBody', 'aubrey-400-latin-e006e0e2.woff2'),
             ('SwordTitle', 'unica-one-400-latin-f1708315.woff2'),
             ('SwordLabel', 'syne-600-latin-48dc6652.woff2')]
    font_dir.mkdir(parents=True, exist_ok=True)
    if not all((font_dir / f'{name}.ttf').exists() for name, _ in names):
        converter = None
        for interpreter in dict.fromkeys([sys.executable, shutil.which('python3')]):
            if not interpreter:
                continue
            probe = subprocess.run([interpreter, '-c', 'import fontTools.ttLib'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if probe.returncode == 0:
                converter = interpreter
                break
        if converter is None:
            raise RuntimeError('Uncached WOFF2 conversion requires fontTools in the current Python or PATH python3.')
        print('Preparing companion fonts with '+converter)
        # Keep source head timestamps: fontTools otherwise stamps the conversion
        # time into the embedded subset, changing PDF bytes on a cold rebuild.
        code = "from fontTools.ttLib import TTFont; import sys; f=TTFont(sys.argv[1], recalcTimestamp=False); f.flavor=None; f.save(sys.argv[2])"
        for name, source in names:
            subprocess.run([converter, '-c', code, str(ROOT / 'src/app/fonts' / source), str(font_dir / f'{name}.ttf')], check=True)
    for name, _ in names:
        pdfmetrics.registerFont(TTFont(name, str(font_dir / f'{name}.ttf')))


def clean(text):
    return str(text).replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', ' - ')


class Page:
    def __init__(self, document, number, total, title, purpose, companion):
        self.c = document
        self.y = HEIGHT - MARGIN
        self.number, self.total = number, total
        self.companion = companion
        self.blocks = []
        self.title = title
        self.c.setFillColor(PAPER)
        self.c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
        self.c.setFillColor(DEEP_TEAL)
        self.c.rect(MARGIN, HEIGHT - 46, CONTENT, 20, fill=1, stroke=0)
        self.c.setFillColor(PALE_GOLD)
        self.c.setFont('SwordLabel', 7.8)
        self.c.drawString(MARGIN + 9, HEIGHT - 39,
                          'SWORDWEAVE / v0.1 ALPHA / ORIGINAL COMPANION')
        metallic_rule(self.c, MARGIN, HEIGHT - 48, CONTENT, 1)
        self.y -= 28
        # A single gradient spans the complete native display title, as in the PHB.
        title_width = pdfmetrics.stringWidth(title, 'SwordTitle', 25)
        if title_width > CONTENT:
            raise ValueError('Display title needs intentional reflow: '+title)
        self.c.saveState()
        text = self.c.beginText(MARGIN, self.y - 25)
        text.setFont('SwordTitle', 25)
        text.setTextRenderMode(7)
        text.textOut(title)
        self.c.drawText(text)
        self.c.linearGradient(MARGIN, self.y - 25, MARGIN + title_width, self.y - 25,
                              [TEAL, GOLD], extend=True)
        self.c.restoreState()
        self.y -= 37
        self.p(purpose, size=11.5, leading=15, after=16)

    def p(self, text, size=11.6, leading=15.6, font='SwordBody', after=8, width=CONTENT, x=MARGIN, record=True, kind='paragraph', color=INK):
        if record:
            self.blocks.append({'type': kind, 'text': clean(text)})
        style = ParagraphStyle('companion', fontName=font, fontSize=size, leading=leading,
                               textColor=color, alignment=TA_LEFT, spaceBefore=0, spaceAfter=0)
        paragraph = Paragraph(escape(clean(text)), style)
        _, height = paragraph.wrap(width, HEIGHT)
        if self.y - height < 62:
            raise ValueError(f'Page {self.number} overflows while placing: {text[:60]}')
        paragraph.drawOn(self.c, x, self.y - height)
        self.y -= height + after
        return height

    def section(self, title, hint=None):
        self.y -= 4
        self.p(title, size=12, leading=15, font='SwordLabel', after=7, kind='heading', color=GOLD)
        if hint:
            self.p(hint, size=10.5, leading=13.5, after=8)

    def field(self, name, label, lines=1, width=CONTENT, x=MARGIN):
        self.blocks.append({'type':'field','text':clean(label),'lines':lines})
        self.p(label, size=9, leading=11.5, font='SwordLabel', after=3, width=width, x=x, record=False)
        height = lines * 16 + 5
        if self.y - height < 62:
            raise ValueError(f'Field {name} crosses the footer')
        self.c.acroForm.textfield(name=name, tooltip=clean(label), x=x, y=self.y-height,
            width=width, height=height, value='', fontName='Helvetica', fontSize=10,
            textColor=INK, fillColor=FIELD, borderColor=RULE, borderWidth=.5,
            borderStyle='underlined', forceBorder=True, fieldFlags='multiline' if lines > 1 else '',
            maxlen=1200 if lines > 1 else 300)
        self.y -= height + 6

    def checks(self, prefix, labels):
        self.blocks.append({'type':'checks','items':[clean(label) for label in labels]})
        self.y -= 3
        for index, label in enumerate(labels):
            self.c.acroForm.checkbox(name=f'{prefix}_check_{index+1}', tooltip=clean(label),
                x=MARGIN, y=self.y-9, size=10, checked=False, buttonStyle='check',
                borderWidth=.6, borderColor=TEAL, fillColor=FIELD, textColor=INK,
                forceBorder=True)
            self.p(label, size=9.5, leading=12, after=5, x=MARGIN+17, width=CONTENT-17, record=False)

    def table(self, headers, rows, widths, size=10.5, leading=13, font='SwordBody'):
        self.blocks.append({'type':'table','headers':[clean(value) for value in headers], 'rows':[[clean(value) for value in row] for row in rows]})
        x = MARGIN
        header_y = self.y
        self.c.setFillColor(PANEL)
        self.c.rect(MARGIN, header_y-17, CONTENT, 20, fill=1, stroke=0)
        for label, width in zip(headers, widths):
            self.p(label, size=9, leading=12, font='SwordLabel', after=0, width=width-10, x=x+5, record=False, color=TEAL)
            self.y = header_y
            x += width
        self.y -= 18
        metallic_rule(self.c, MARGIN, self.y+3, CONTENT, .75, SILVER_STOPS)
        for row in rows:
            top = self.y
            bottom = top
            x = MARGIN
            for value, width in zip(row, widths):
                self.p(value, size=size, leading=leading, font=font, after=0, width=width-10, x=x+5, record=False)
                bottom = min(bottom, self.y)
                self.y = top
                x += width
            self.y = bottom - 9
            self.c.setStrokeColor(RULE)
            self.c.setLineWidth(.4)
            self.c.line(MARGIN, self.y+3, MARGIN+CONTENT, self.y+3)
        self.y -= 9

    def foundations(self, rows):
        """Whole existing portraits teach the three saved origins beside their text."""
        self.blocks.append({'type':'table', 'headers':['Foundation','What it contributes to this concept'],
                            'rows':[[row['name'],row['text']] for row in rows]})
        for row in rows:
            top = self.y
            self.c.drawImage(str(ASSET_DIR / (row['key']+'.jpg')),
                             MARGIN, top-64, width=64, height=64)
            metallic_rule(self.c, MARGIN, top-66, 64, 1.2)
            self.p(row['name'], size=10.5, leading=13.5, font='SwordLabel',
                   after=5, x=MARGIN+78, width=CONTENT-78, record=False, color=GOLD)
            self.p(row['text'], size=11, leading=14.5, after=0,
                   x=MARGIN+78, width=CONTENT-78, record=False)
            self.y = min(self.y, top-66) - 9
        self.p('Existing heritage illustrations: AI-generated with OpenAI tools under Marius Ion\'s direction. Artwork retains separate notices; companion text CC BY 4.0 does not license these portraits.',
               size=8.5, leading=11, after=10)

    def footer(self, links):
        if self.y < 59:
            raise ValueError(f'Page {self.number} has no footer clearance')
        metallic_rule(self.c, MARGIN, 53, CONTENT, .7)
        terminal(self.c, MARGIN, 53.35)
        terminal(self.c, WIDTH-MARGIN, 53.35)
        self.c.setFillColor(INK)
        self.c.setFont('SwordLabel', 7)
        self.c.drawString(MARGIN, 39, 'Marius Ion / SwordWeave | CC BY 4.0 original companion text | 20 Oct 2026')
        self.c.linkURL('https://creativecommons.org/licenses/by/4.0/', (MARGIN, 34, WIDTH-MARGIN-40, 47), relative=0, thickness=0)
        self.c.setFillColor(GOLD)
        self.c.drawRightString(WIDTH-MARGIN, 39, f'{self.number} / {self.total}')
        self.c.setFont('SwordBody', 8.5)
        x = MARGIN
        for link in links:
            label = clean(link['title'])
            w = pdfmetrics.stringWidth(label, 'SwordBody', 8.5)
            self.c.setFillColor(TEAL)
            self.c.drawString(x, 24, label)
            self.c.linkURL(link['url'], (x, 21, x+w, 33), relative=0, thickness=0)
            x += w + 24
        self.c.companion_pages.append({'title':self.title, 'blocks':self.blocks, 'links':links})
        self.c.showPage()


def new_document(path, title):
    c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle(title)
    c.setAuthor('Marius Ion / SwordWeave')
    c.setSubject('Original printable and fillable v0.1 alpha companion; no new game rules.')
    c.companion_pages = []
    return c


READABLE = []


def readable(document, slug, title, description):
    record = {'slug':slug,'title':title,'description':description,'pageCount':len(document.companion_pages),
              'pdf':f'/press/materials/{slug}.pdf','markdown':f'/press/materials/{slug}.md',
              'pages':document.companion_pages}
    READABLE.append(record)
    text=[f'# {title}', 'SwordWeave v0.1 alpha / 20 October 2026', description]
    for page in record['pages']:
        text.append(f"## {page['title']}")
        for block in page['blocks']:
            kind=block['type']
            if kind=='heading': text.append('### '+block['text'])
            elif kind=='paragraph': text.append(block['text'])
            elif kind=='field': text.append('**Write:** '+block['text']+f" ({block['lines']} writing lines in the fillable PDF.)")
            elif kind=='checks': text.append('\n'.join('- [ ] '+item for item in block['items']))
            elif kind=='table':
                rows=[block['headers'],['---']*len(block['headers']),*block['rows']]
                text.append('\n'.join('| '+' | '.join(value.replace('|','\\|') for value in row)+' |' for row in rows))
        text.extend(f"- [{link['title']}]({link['url']})" for link in page['links'])
    text += ['Original companion text: Marius Ion / SwordWeave, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). No new game rules are established by this worksheet.',
             f'Source and current edition: {SITE}/press#materials']
    (OUTPUT/f'{slug}.md').write_text('\n\n'.join(text)+'\n')


def session_sheet():
    data = json.loads((ROOT / 'src/lib/marketing/first-session-run-sheet.json').read_text())
    path = OUTPUT / 'swordweave-first-session-run-sheet.pdf'
    c = new_document(path, data['title'])
    for number, source in enumerate(data['pages'], 1):
        page = Page(c, number, 2, source['title'], source['purpose'], data['title'])
        if number == 1:
            page.p(data['intro'], size=10.5, leading=13.5, after=9)
        for section in source['sections']:
            page.section(section['title'], section['hint'])
            for field in section['fields']:
                page.field('session_'+field['name'], field['label'], field['lines'])
        page.checks('session_page_'+str(number), source['checks'])
        page.footer(source['links'])
    c.save()
    readable(c,'swordweave-first-session-run-sheet',data['title'],data['intro'])
    return path


def neris_companion():
    data = json.loads((ROOT / 'tmp/pdfs/neris-source.json').read_text())
    art_sources = json.loads((ASSET_DIR / 'sources.json').read_text())
    for art in art_sources['assets']:
        if sha256((ASSET_DIR / art['file']).read_bytes()).hexdigest() != art['exportSha256']:
            raise ValueError('Companion portrait differs from its source record: '+art['name'])
    e, acquisitions, stages, treatment = data['example'], data['acquisitions'], data['stages'], data['treatment']
    path = OUTPUT / 'swordweave-build-with-neris.pdf'
    c = new_document(path, 'Build with Neris Cinderthread')
    links = [{'title':'Full character walkthrough','url':SITE+'/character#build-example'},
             {'title':'Inspect the public sheet','url':SITE+e['url']}]
    page = Page(c, 1, 3, 'Build with Neris Cinderthread',
                'Read an existing build as a chain of decisions, then plan a variation of your own.', 'Neris')
    page.p('Checked public level-8 demonstration, 20 October 2026. This is a reading and construction companion, not a new level-1 template or evidence of independent playtesting. Use your GM\'s starting point.')
    page.section('Begin with the person')
    page.p(e['concept'])
    page.p('One way to read these choices: trained hands and knowledge support treatment; smoke filtration makes an ordinary smoky route possible; saved recipes keep a bounded use ready. The foundations support the concept without becoming fixed classes.')
    page.table(['Physical','Mental','Magical','Proficiency','Vitality'],
               [[str(e['attributes']['physical']),str(e['attributes']['mental']),str(e['attributes']['magical']),f"+{e['pb']} / Mental",f"{e['maxVitality']} maximum"]], [80,80,80,139,CONTENT-379])
    page.section('Read the three foundations')
    page.foundations([
        {'name':'Ashlung', 'key':'ashlung', 'text':'Fire Resistance and Ordinary Smoke Filtration. Light ordinary smoke is different from heat, toxic gas or magical fumes.'},
        {'name':'Field Surgeon Apprentice', 'key':'field-surgeon-apprentice', 'text':'Training, careful handling, carrying support and Splint and Rally. Appropriate supplies and a reachable patient still matter.'},
        {'name':'Thread Surgeon', 'key':'thread-surgeon', 'text':'Finesse and Knowledge training, useful bonuses, material patching and familiar treatment pieces. Shared acquisitions are counted once.'},
    ])
    page.section('Keep access and budgets distinct')
    page.p(f"Level 8 contributes {e['progressionBu']} BU. This saved demo adds {e['dmBonusBu']} DM BU: {e['budgetBu']} total. Its {e['uniqueCharacterAcquisitions']} unique character acquisitions cost {e['spentBu']} BU, leaving {e['remainingBu']}. Items cost {e['itemBu']} Item BU separately.")
    page.p('No separate Domain acquisition is stored in this snapshot. Read its bounded authored physical treatments; do not infer unrestricted magical healing. When you fork or build a new character, review the current required access, foundation and budget before applying changes.',size=10.5,leading=13.5)
    page.field('neris_concept','Your person: what do they do, and what do they want?',2)
    page.footer(links)

    page = Page(c, 2, 3, 'Count ownership, then reuse it',
                'The same acquisition can appear in several compositions without becoming another purchase.', 'Neris')
    page.table(['Read in this order','New BU','Running BU'],
               [[row['name'],str(row['addedBu']),str(row['runningBu'])] for row in stages],
               [CONTENT-135,65,70],size=10.5)
    page.p('These are new costs in this reading order, not the displayed price of each whole bundle. A later foundation can reference pieces acquired earlier. Count the saved acquisition identity once; a same-name entry alone does not establish that it is the same purchase.',size=10.5,leading=13.5)
    page.section('The complete unique character ledger')
    # Two compact lists retain every named acquisition without shrinking body text.
    left, right = acquisitions[:10], acquisitions[10:]
    rows=[]
    for index in range(10):
        a=left[index] if index<len(left) else None
        b=right[index] if index<len(right) else None
        rows.append([f"{a['name']} (v{a['version']})" if a else '',str(a['bu']) if a else '',
                     f"{b['name']} (v{b['version']})" if b else '',str(b['bu']) if b else ''])
    page.table(['Acquisition','BU','Acquisition','BU'],rows,[CONTENT/2-27,27,CONTENT/2-27,27],size=9.5,leading=12)
    page.p(f"Character total: {e['spentBu']} BU. Remaining: {e['budgetBu']} - {e['spentBu']} = {e['remainingBu']} BU. Touch and the stored d4 cost zero here; their presence does not buy extra range or a different behavior.",size=10.5,leading=13.5)
    page.section('Items stay on their own ledger')
    page.p('; '.join(f"{item['name']}: {item['itemBu']} Item BU" for item in data['items'])+'. Total: '+str(e['itemBu'])+' Item BU. Item-supplied ingredients are not extra character acquisitions.',size=10.5,leading=13.5)
    page.field('neris_reuse','Which owned acquisition would your next idea reuse? What genuinely new access would it need?',2)
    page.footer(links)

    page = Page(c, 3, 3, 'Resolve Gentle Treatment',
                'A bounded worked use, followed by room to plan your own variation.', 'Neris')
    page.section('Read the saved recipe before rolling')
    page.p('Gentle Treatment uses Patient Reassurance Influence +2 and Mended Vitality, whose stored output is Minor Die Block (1d4). The reassurance applies only with a willing patient during the named treatment; end that condition when treatment ends or consent is withdrawn.')
    page.p('Neris also owns a d8. It does not silently replace the saved 1d4 recipe. Changing a recipe requires reviewing its access, scope and Cost; owning an ingredient is different from resolving a use.')
    page.section('One illustrative table agreement')
    page.p(f"A willing, reachable patient has {treatment['patientBefore']} of {treatment['patientMaximum']} Vitality, with time outside immediate danger. A suitable clean dressing is available. The table agrees a bounded treatment, an Influence check against DC {treatment['difficulty']}, {treatment['outputDie']} recovery on success, and one dressing spent. No extra Vitality Cost is chosen for this attempt; these are scene agreements, not universal treatment rules.")
    page.table(['Decision','Calculation / state'],[
        ['Check the active scope',f"Ordinary Influence +{e['ordinaryInfluence']}; applicable reassurance +2 gives +{e['treatmentInfluence']}."],
        ['Resolve the check',f"d20 shows {treatment['d20']}; {treatment['d20']} + {treatment['checkBonus']} = {treatment['checkTotal']}, meeting DC {treatment['difficulty']}. Do not add PB again."],
        ['Resolve recovery',f"The authored {treatment['outputDie']} shows {treatment['rolledHealing']}. The patient moves from {treatment['patientBefore']}/{treatment['patientMaximum']} to {treatment['patientAfter']}/{treatment['patientMaximum']} Vitality."],
        ['Record the Cost',f"Dressing: {treatment['dressingBefore']} to {treatment['dressingAfter']}. Neris stays at {treatment['nerisAfter']}/{e['maxVitality']} Vitality. End the treatment-only reassurance condition."],
    ],[138,CONTENT-138],size=10.5)
    page.p('Roll and apply the agreed changes manually. Saving or triggering the capability does not automatically heal a different sheet. Record the supply spent and the new situation; further treatment needs its own fiction and agreement.',size=10.5,leading=13.5)
    page.section('Plan a personal variation')
    page.field('neris_variation','What result do you want? Which owned ingredients permit it?',2)
    page.field('neris_agreement','Scope, target, resolution, Cost, ending and exact values to update',2)
    page.p('Open the public sheet to inspect it; Fork requires an account and creates your own copy. Review the fork before editing. For a fresh character, use the existing character builder and your table\'s agreed foundation.',size=10.5,leading=13.5)
    page.footer(links)
    c.save()
    readable(c,'swordweave-build-with-neris','Build with Neris Cinderthread','A source-checked construction trail, unique-acquisition ledger and resolved use, with prompts for a personal variation.')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-site-data', action='store_true',
                        help='Build only PDF/Markdown companions; leave website content data unchanged.')
    parser.add_argument('--font-dir', type=Path, default=FONT_DIR,
                        help='TTF cache directory; an empty temporary directory verifies fresh font conversion.')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    prepare_fonts(args.font_dir)
    paths=[session_sheet()]
    if (ROOT / 'tmp/pdfs/neris-source.json').exists():
        paths.append(neris_companion())
    for path in paths:
        print(path.relative_to(ROOT))
    if not args.no_site_data:
        (ROOT/'src/lib/marketing/companion-content.json').write_text(json.dumps(READABLE,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__':
    main()
