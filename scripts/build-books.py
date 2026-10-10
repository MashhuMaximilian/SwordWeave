"""Build six PDFs, web reader data and vector figures from the three manuscripts.

Run with the bundled PDF Python runtime. Font conversion uses local fontTools.
Outputs are deterministic except for PDF producer timestamps. No cloud mutations.
"""
from pathlib import Path
import base64, hashlib, html, json, re, subprocess
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Flowable, Table, TableStyle, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
ASSETS = ROOT / 'public/books/figures'
DATA = ROOT / 'src/lib/publications'
TMP = ROOT / 'tmp/pdfs/books'
for p in (OUT, ASSETS, DATA, TMP): p.mkdir(parents=True, exist_ok=True)
VERSION = 'v0.1-alpha'
ORIGIN = '/books/' + VERSION
W, H, M = 595.2756, 841.8898, 51
CW = W - 2*M
GOLD = ['#b68b3f','#e8c47a','#fff3bb','#ceac60','#e7c780','#ad813c','#f2d994']
TEAL = ['#4e9290','#8dc2b3','#c6ead6','#69aaa0','#96c5b5','#53918d','#b2d6c4']
SILVER = ['#6e8589','#d8e3e3','#ffffff','#82999e','#edf5f4','#7e969b']
FONTS = {'Display':'unica-one-400-latin-f1708315.woff2', 'Body':'aubrey-400-latin-e006e0e2.woff2', 'Bold':'syne-600-latin-48dc6652.woff2', 'Italic':'oxanium-500-latin-320e2c0e.woff2', 'Technical':'ibm-plex-mono-400-latin-bc87d8e0.woff2'}
for name, source in FONTS.items():
    target=TMP/(name+'.ttf')
    if not target.exists():
        subprocess.run(['python3','-c',"from fontTools.ttLib import TTFont; from fontTools.varLib.instancer import instantiateVariableFont; import sys; f=TTFont(sys.argv[1]); f=instantiateVariableFont(f, {'wght':600}, inplace=True) if 'fvar' in f else f; f.flavor=None; f.save(sys.argv[2])", str(ROOT/'src/app/fonts'/source), str(target)],check=True)
    pdfmetrics.registerFont(TTFont(name,str(target)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Italic',boldItalic='Bold')

BOOKS = [
 {'slug':'players-handbook','file':'players-handbook.md','short':'PHB','title':"Player's Handbook",'subtitle':'Imagine a person. Give them rules. Play a shared story.','description':'Learn to create a character, compose abilities, coordinate a shared round and carry the consequences.','accent':'gold'},
 {'slug':'game-masters-guide','file':'game-masters-guide.md','short':'GM Guide','title':"Game Master's Guide",'subtitle':'Prepare situations. Make clear rulings. Let choices matter.','description':'Run your first session, review creations, author creatures and prepare encounters with practical worksheets.','accent':'teal'},
 {'slug':'srd','file':'system-reference-document.md','short':'SRD','title':'System Reference Document','subtitle':'The open construction and play framework.','description':'A precise reference for the rules, 29 primitive families, construction procedures and compatible creation.','accent':'silver'},
]

def slugify(s):
    return re.sub(r'[^a-z0-9]+','-',s.lower().replace("'",'').replace('’','')).strip('-')

def plain(s):
    s=re.sub(r'\[([^]]+)\]\([^)]+\)',r'\1',s)
    return s.replace('**','').replace('`','').replace('*','')

def parse(text):
    lines=text.strip().splitlines(); blocks=[]; i=0; ids=set()
    while i < len(lines):
        line=lines[i].strip()
        if not line: i+=1; continue
        if line.startswith('# '): i+=1; continue
        if line==':::index':
            blocks.append({'type':'index'});i+=1;continue
        if line.startswith(':::figure '):
            blocks.append({'type':'figure','name':line.split()[-1]});i+=1;continue
        if line.startswith('##'):
            level=len(line)-len(line.lstrip('#')); title=line[level:].strip(); ident=slugify(title)
            if ident in ids: raise ValueError('Duplicate heading: '+ident)
            ids.add(ident);blocks.append({'type':'heading','level':level,'text':title,'id':ident});i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c.replace(' ','')) for c in cells): rows.append(cells)
                i+=1
            if any(len(row)!=len(rows[0]) for row in rows): raise ValueError('Ragged table')
            blocks.append({'type':'table','rows':rows});continue
        match=re.match(r'^(- |\d+\. )(.*)',line)
        if match:
            ordered=not line.startswith('- '); items=[]
            while i<len(lines):
                m=re.match(r'^(- |\d+\. )(.*)',lines[i].strip())
                if not m: break
                items.append(m.group(2));i+=1
            blocks.append({'type':'list','ordered':ordered,'items':items});continue
        if line.startswith('>'):
            content=[]
            while i<len(lines) and lines[i].strip().startswith('>'):
                v=lines[i].strip().lstrip('>').strip()
                if v: content.append(v)
                i+=1
            blocks.append({'type':'aside','paragraphs':content});continue
        content=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||>|:::|- |\d+\. )',lines[i].strip()):
            content.append(lines[i].strip());i+=1
        blocks.append({'type':'paragraph','text':' '.join(content)})
    return blocks

LINK_COLOR='#126668'
def inline(s):
    s=s.replace('→',' then ').replace('↔',' / ').replace('ΔCV','delta CV').replace('Δ','delta').replace('≥','at least').replace('√','sqrt')
    s=html.escape(s,quote=False)
    s=re.sub(r'\[([^]]+)\]\((https?://[^)]+|#[^)]+)\)',rf'<a href="\2" color="{LINK_COLOR}"><u>\1</u></a>',s)
    s=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<i>\1</i>',s)
    s=re.sub(r'`([^`]+)`',r'<font name="Technical">\1</font>',s)
    return s

# Shared diagram geometry. Labels deliberately stay short; captions teach meaning.
FIGURES = {
 'intent': {'title':'From an idea to a changed scene','caption':'Agree access, scope and stakes before commitment. A player may revise the attempt; the recorded result becomes the next situation.','height':220,'nodes':[(12,68,130,84,'Intent',['What do you want?']),(154,68,130,84,'Access',['What supports it?']),(296,68,130,84,'Agreement',['Scope, stakes, Cost']),(438,68,130,84,'Resolution',['Roll if uncertain']),(580,68,128,84,'Record',['What changed?'])],'edges':[(142,110,154,110),(284,110,296,110),(426,110,438,110),(568,110,580,110)]},
 'composition': {'title':'Compose without buying the same rule again','caption':'Lines are references to owned acquisitions. A primitive can be used directly or through several containers; appearances do not create extra purchases.','height':310,'nodes':[(24,62,206,65,'Heritages',['Lineage / Upbringing / Manifest']),(257,62,206,65,'Capabilities',['A working or talent']),(490,62,206,65,'Items',['Separate Item BU ledger']),(257,154,206,62,'Effects',['Reusable ingredient groups']),(180,241,360,55,'Owned primitives',['Permissions, changes, conditions'])],'edges':[(360,241,360,216),(360,154,360,127),(257,95,230,95),(463,95,490,95),(180,266,126,127),(540,266,592,127)]},
 'rhythm': {'title':'One shared round, coordinated together','caption':'Complexity places dependencies in the rhythm. Movement is one round allowance; a valid reaction pauses a moment without creating a new personal turn.','height':223,'nodes':[(12,66,165,91,'Council',['Coordinate intent','Review continuation']),(189,66,165,91,'Fast',['Complexity 0–1','Immediate dependencies']),(366,66,165,91,'Measured',['Complexity 2–3','Dependent actions']),(543,66,165,91,'Heavy',['Complexity 4+','Further dependencies'])],'edges':[(177,112,189,112),(354,112,366,112),(531,112,543,112)]},
 'access': {'title':'Permission, expression and consequence','caption':'Increasing effort can scale an eligible use. It does not supply a missing verb, domain, behavior or sensory location.','height':218,'nodes':[(20,70,208,90,'Access',['What change / subject?','Where can you target?']),(256,70,208,90,'Expression',['How much, how far, how long?','What actual recipients?']),(492,70,208,90,'Appraisal',['Situation, Strain, Cost','Agreement before commitment'])],'edges':[(228,115,256,115),(464,115,492,115)]},
 'recovery': {'title':'Unused short-rest recovery carries forward','caption':'Maximum 13: the allowance is ceil(13/2) = 7. Consume only actual healing; a completed long rest refreshes the allowance.','height':224,'nodes':[(20,70,208,90,'First short rest',['Vitality 10 → 13','Use 3; keep 4']) ,(256,70,208,90,'Later short rest',['Vitality 9 → 13','Use 4; allowance 0']),(492,70,208,90,'Completed long rest',['Agreed overnight recovery','Refresh allowance to 7'])],'edges':[(228,115,256,115),(464,115,492,115)]},
 'consequence': {'title':'A consequence should answer three questions','caption':'Record the actual change and when it applies. A familiar condition name imports no automatic package; ending and recovery are explicit.','height':224,'nodes':[(20,70,208,90,'Cause',['What attempt or event?','Who is affected?']),(256,70,208,90,'Change',['Penalty, restriction or story','When does it apply?']),(492,70,208,90,'Ending',['Duration, condition or task','What restores the option?'])],'edges':[(228,115,256,115),(464,115,492,115)]},
 'budgets': {'title':'Keep the three questions separate','caption':'Appraisal multiplies chosen base creature BU and separate Item BU by quantity. Mirror credit is not another creature; execution Cost is not purchased again.','height':224,'nodes':[(20,68,208,96,'Creature BU',['Chosen base × quantity','Build spent / remaining separate']),(256,68,208,96,'Item BU',['Equipment × quantity','Do not count it twice']),(492,68,208,96,'Execution Cost',['Agreed for actual use','Mechanical / restrictive / narrative'])],'edges':[]},
}

def palette(dark):
    return {'paper':'#102126' if dark else '#f1f5ec','ink':'#f0f2e9' if dark else '#142e31','muted':'#c4d6d0' if dark else '#386263','gold':'#f3db9d' if dark else '#684711','rule':'#f0b38c' if dark else '#904422','panel':'#19363b' if dark else '#e1ede5','line':'#718e8e' if dark else '#82999e'}

SVG_FONTS=''.join('@font-face{font-family:"'+family+'";src:url(data:font/woff2;base64,'+base64.b64encode((ROOT/'src/app/fonts'/FONTS[name]).read_bytes()).decode()+') format("woff2");font-weight:'+weight+';}' for name,family,weight in [('Display','Unica One','400'),('Body','Aubrey','400'),('Bold','Syne','600')])

def svg_figure(key,dark):
    f=FIGURES[key];p=palette(dark);h=f['height'];parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 {h}" role="img" aria-labelledby="title desc"><title id="title">{html.escape(f["title"])}</title><desc id="desc">{html.escape(f["caption"])}</desc>', '<defs><linearGradient id="metal"><stop stop-color="#b68b3f"/><stop offset=".4" stop-color="#fff3bb"/><stop offset=".7" stop-color="#69aaa0"/><stop offset="1" stop-color="#d8e3e3"/></linearGradient><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="'+p['line']+'"/></marker></defs>',f'<rect x="1" y="1" width="718" height="{h-2}" rx="12" fill="{p["paper"]}" stroke="{p["line"]}"/><rect x="18" y="17" width="684" height="3" fill="url(#metal)"/><text x="24" y="45" fill="{p["gold"]}" font-family="Unica One, sans-serif" font-size="21">{html.escape(f["title"])}</text>']
    for x1,y1,x2,y2 in f['edges']:parts.append(f'<path d="M{x1},{y1} L{x2},{y2}" fill="none" stroke="{p["line"]}" stroke-width="2" marker-end="url(#arrow)"/>')
    for x,y,w,h2,title,sub in f['nodes']:
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h2}" rx="7" fill="{p["panel"]}" stroke="url(#metal)" stroke-width="2"/><text x="{x+w/2}" y="{y+25}" text-anchor="middle" fill="{p["ink"]}" font-family="Syne, sans-serif" font-size="15" font-weight="600">{html.escape(title)}</text>')
        for j,s in enumerate(sub):parts.append(f'<text x="{x+w/2}" y="{y+45+j*17}" text-anchor="middle" fill="{p["muted"]}" font-family="Aubrey, sans-serif" font-size="16">{html.escape(s)}</text>')
    parts.insert(1,'<style>'+SVG_FONTS+'</style>');parts.append('</svg>');return ''.join(parts)
for key in FIGURES:
    for dark in (False,True): (ASSETS/(key+('-dark' if dark else '-light')+'.svg')).write_text(svg_figure(key,dark))

def gradient(c,x,y,w,h,stops,radius=0):
    c.saveState();path=c.beginPath()
    if radius: path.roundRect(x,y,w,h,radius)
    else: path.rect(x,y,w,h)
    c.clipPath(path,stroke=0,fill=0)
    c.linearGradient(x,y,x+w,y+h,[colors.HexColor(v) for v in stops],[i/(len(stops)-1) for i in range(len(stops))],extend=True)
    c.restoreState()

class Figure(Flowable):
    def __init__(self,key,dark):super().__init__();self.key=key;self.dark=dark;self.width=CW;self.height=FIGURES[key]['height']*CW/720
    def draw(self):
        c=self.canv;f=FIGURES[self.key];p=palette(self.dark);scale=CW/720;c.saveState();c.scale(scale,scale);h=f['height']
        c.setFillColor(colors.HexColor(p['paper']));c.setStrokeColor(colors.HexColor(p['line']));c.roundRect(0,0,720,h,12,fill=1,stroke=1)
        gradient(c,18,h-20,684,3,GOLD[:3]+TEAL[3:5]+SILVER[1:3]);c.setFillColor(colors.HexColor(p['gold']));c.setFont('Display',21);c.drawString(24,h-45,f['title'])
        c.setStrokeColor(colors.HexColor(p['line']));c.setLineWidth(2)
        for x1,y1,x2,y2 in f['edges']:
            y1=h-y1;y2=h-y2;c.line(x1,y1,x2,y2)
            import math
            a=math.atan2(y2-y1,x2-x1);path=c.beginPath();path.moveTo(x2,y2);path.lineTo(x2-7*math.cos(a-.45),y2-7*math.sin(a-.45));path.lineTo(x2-7*math.cos(a+.45),y2-7*math.sin(a+.45));path.close();c.setFillColor(colors.HexColor(p['line']));c.drawPath(path,fill=1,stroke=0)
        for x,y,w,h2,title,sub in f['nodes']:
            yy=h-y-h2;c.setFillColor(colors.HexColor(p['panel']));c.setStrokeColor(colors.HexColor(p['line']));c.roundRect(x,yy,w,h2,7,fill=1,stroke=1);gradient(c,x+8,yy+h2-3,w-16,2,GOLD)
            c.setFillColor(colors.HexColor(p['ink']));c.setFont('Bold',15);c.drawCentredString(x+w/2,h-y-25,title)
            for j,s in enumerate(sub):c.setFont('Body',16);c.setFillColor(colors.HexColor(p['muted']));c.drawCentredString(x+w/2,h-y-45-j*17,s.replace('→','to'))
        c.restoreState()

class Cover(Flowable):
    def __init__(self,book,dark):super().__init__();self.book=book;self.dark=dark;self.width=CW;self.height=H-150
    def draw(self):
        c=self.canv;p=palette(self.dark);height=self.height;c.saveState()
        c.setFillColor(colors.HexColor(p['gold']));c.setFont('Technical',10);c.drawString(0,height-28,'SWORDWEAVE  /  FREE CORE BOOKS')
        gradient(c,0,height-53,CW,5,GOLD if self.book['accent']=='gold' else TEAL if self.book['accent']=='teal' else SILVER)
        c.setFont('Display',50);c.setFillColor(colors.HexColor(p['ink']));c.drawString(0,height-127,'Sword·Weave')
        para=Paragraph(self.book['title'],ParagraphStyle('cover',fontName='Display',fontSize=41,leading=45,textColor=colors.HexColor(p['ink'])))
        _,hh=para.wrap(CW,150);para.drawOn(c,0,height-163-hh)
        para=Paragraph(self.book['subtitle'],ParagraphStyle('deck',fontName='Italic',fontSize=14,leading=22,textColor=colors.HexColor(p['muted'])))
        _,hh2=para.wrap(CW-35,100);para.drawOn(c,0,height-188-hh-hh2)
        cx=CW/2;cy=185
        c.setStrokeColor(colors.HexColor(p['line']));c.setLineWidth(.65)
        for r in (57,83,107):c.circle(cx,cy,r,stroke=1,fill=0)
        for angle in range(0,360,60):
            import math
            a=math.radians(angle);c.line(cx+57*math.cos(a),cy+57*math.sin(a),cx+107*math.cos(a),cy+107*math.sin(a))
        gradient(c,cx-40,cy-3,80,6,GOLD);gradient(c,cx-3,cy-40,6,80,TEAL)
        c.setFont('Technical',10);c.setFillColor(colors.HexColor(p['muted']));c.drawString(0,49,'MARIUS ION  /  v0.1 alpha  /  11 OCTOBER 2026')
        c.setFont('Body',12);c.drawString(0,28,'Original rules, text and instructional diagrams: CC BY 4.0')
        c.setFont('Body',12);c.drawString(0,8,'swordweave.quest/books  /  '+('Dark' if self.dark else 'Light')+' digital edition')
        c.restoreState()

class Heading(Paragraph):
    def __init__(self,block,style):super().__init__(inline(block['text']),style);self.bookmark=block['id'];self.title=plain(block['text']);self.level=block['level']-2

class TopicIndex(TableOfContents):
    def notify(self,kind,stuff):
        if kind=='TopicIndex':self.addEntry(0,stuff[0],stuff[1],stuff[2])
    def beforeBuild(self):
        super().beforeBuild()
        self._lastEntries.sort(key=lambda entry:entry[1].casefold())
    def isSatisfied(self):
        return sorted(self._entries,key=lambda entry:entry[1].casefold())==self._lastEntries

class BookDoc(BaseDocTemplate):
    def __init__(self,path,book,dark):
        super().__init__(str(path),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=62,bottomMargin=58,title='SwordWeave '+book['title']+' · v0.1 alpha',author='Marius Ion',subject='Free SwordWeave core rules: original text and diagrams CC BY 4.0',pageCompression=1)
        self.book=book;self.dark=dark;self.currentChapter=book['short'];self.pageMap={};self._onProgress=None
        self.addPageTemplates(PageTemplate(id='book',frames=[Frame(M,58,CW,H-120,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=self.page_background))
    def beforeDocument(self):self.currentChapter=self.book['short'];self.pageMap={}
    def page_background(self,c,doc):
        p=palette(self.dark);c.saveState();gradient(c,0,0,W,H,['#08161c','#102126','#1b3539'] if self.dark else ['#d6e4dc','#f1f5ec','#fcfcf4'])
        c.setLineWidth(.5);c.setStrokeColor(colors.HexColor(p['line']));c.line(M,39,W-M,39)
        if doc.page>1:
            c.setFont('Technical',7.6);c.setFillColor(colors.HexColor(p['muted']));c.drawString(M,H-31,'SWORDWEAVE  /  '+self.book['short'].upper())
            title=self.currentChapter
            while pdfmetrics.stringWidth(title,'Body',10)>CW-160:title=title[:-2]
            c.setFont('Body',10);c.drawRightString(W-M,H-31,title);gradient(c,M,H-43,CW,1.4,TEAL+GOLD)
        c.setFont('Technical',7.5);c.setFillColor(colors.HexColor(p['muted']));c.drawString(M,25,'v0.1 alpha  ·  CC BY 4.0');c.drawRightString(W-M,25,str(doc.page));c.restoreState()
    def afterFlowable(self,f):
        if isinstance(f,Heading):
            self.canv.bookmarkPage(f.bookmark);self.canv.addOutlineEntry(f.title,f.bookmark,level=f.level,closed=False);self.pageMap[f.bookmark]=self.page
            if f.level==0:
                self.currentChapter=f.title
                c=self.canv;p=palette(self.dark);c.saveState();gradient(c,0,H-39,W,39,['#1b3539','#102126'] if self.dark else ['#fcfcf4','#f1f5ec']);c.setFont('Technical',7.6);c.setFillColor(colors.HexColor(p['muted']));c.drawString(M,H-31,'SWORDWEAVE  /  '+self.book['short'].upper());c.setFont('Body',10);c.drawRightString(W-M,H-31,self.currentChapter);c.restoreState()
            self.notify('TOCEntry',(f.level,f.title,self.page,f.bookmark))
            if f.bookmark!='topic-index':self.notify('TopicIndex',(f.title,self.page,f.bookmark))

def styles(dark):
    p=palette(dark);s={}
    s['body']=ParagraphStyle('body',fontName='Body',fontSize=12.8,leading=17.1,textColor=colors.HexColor(p['ink']),spaceAfter=9,allowWidows=0,allowOrphans=0)
    s['small']=ParagraphStyle('small',parent=s['body'],fontSize=11,leading=14.1,textColor=colors.HexColor(p['muted']),spaceAfter=10)
    s['h2']=ParagraphStyle('h2',fontName='Display',fontSize=29,leading=32,textColor=colors.HexColor(p['gold']),spaceBefore=9,spaceAfter=15,keepWithNext=True)
    s['h3']=ParagraphStyle('h3',fontName='Display',fontSize=19,leading=22,textColor=colors.HexColor(p['gold']),spaceBefore=12,spaceAfter=7,keepWithNext=True)
    s['cell']=ParagraphStyle('cell',parent=s['body'],fontSize=11.4,leading=14.7,spaceAfter=0)
    s['headcell']=ParagraphStyle('headcell',fontName='Bold',fontSize=9.5,leading=13,textColor=colors.HexColor('#271903'),spaceAfter=0)
    s['rule']=ParagraphStyle('rule',parent=s['body'],textColor=colors.HexColor(p['rule']))
    s['callout']=ParagraphStyle('callout',parent=s['body'],leftIndent=12,rightIndent=12,borderColor=colors.HexColor(p['line']),borderWidth=.6,borderPadding=10,backColor=colors.HexColor(p['panel']),spaceBefore=8,spaceAfter=15)
    s['toc0']=ParagraphStyle('toc0',fontName='Bold',fontSize=11.1,leading=15,textColor=colors.HexColor(p['ink']),spaceBefore=6,leftIndent=0,firstLineIndent=0)
    s['toc1']=ParagraphStyle('toc1',fontName='Body',fontSize=10.6,leading=12.6,textColor=colors.HexColor(p['muted']),leftIndent=12,firstLineIndent=0)
    return s

class MaterialTable(Table):
    def draw(self):
        gradient(self.canv,0,self._height-self._rowHeights[0],self._width,self._rowHeights[0],GOLD)
        super().draw()

def table_flow(rows,s,dark):
    n=len(rows[0]);lengths=[max(min(len(plain(row[j])),100) for row in rows) for j in range(n)]
    if n==2: ratios=[.29,.71]
    elif n==3:
        numeric_last=all(re.fullmatch(r'[\d.,+−–/ %]+',plain(row[-1])) for row in rows[1:])
        if numeric_last and max(lengths)>45:ratios=[.28,.57,.15]
        elif lengths[2]>45 and lengths[1]<30:ratios=[.17,.22,.61]
        elif max(lengths)>45:ratios=[.18,.40,.42]
        else:ratios=[1/n]*n
    elif n==4: ratios=[1/n]*n
    elif n==5: ratios=[.10,.26,.26,.26,.12]
    else:ratios=[1/n]*n
    content=[[Paragraph(inline('BU' if i==0 and c=='Suggested BU' else c),s['headcell'] if i==0 else s['cell']) for c in row] for i,row in enumerate(rows)]
    t=MaterialTable(content,colWidths=[CW*r for r in ratios],repeatRows=1,hAlign='LEFT',spaceBefore=5,spaceAfter=14,splitByRow=1)
    p=palette(dark);t.setStyle(TableStyle([('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor(p['panel']),colors.HexColor(p['paper'])]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,0),1,colors.HexColor('#b68b3f')),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor(p['line']))]))
    return t

def build(book,dark):
    global LINK_COLOR
    LINK_COLOR='#f3db9d' if dark else '#126668'
    s=styles(dark);name=book['slug']+('-dark' if dark else '')+'.pdf';dest=OUT/name;doc=BookDoc(dest,book,dark)
    toc=TableOfContents();toc.levelStyles=[s['toc0'],s['toc1']];toc.dotsMinLevel=0;toc.tableStyle=TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1),('VALIGN',(0,0),(-1,-1),'TOP')])
    story=[Cover(book,dark),PageBreak(),Paragraph('Contents',s['h2']),Paragraph('Clickable chapters, bookmarks and section anchors help you find the rule at the table. Page numbers refer to this PDF edition.',s['small']),toc,PageBreak()]
    first=True
    for b in book['blocks']:
        kind=b['type']
        if kind=='heading':
            if b['level']==2:
                if not first:story.append(PageBreak())
                first=False
            story.append(Heading(b,s['h2'] if b['level']==2 else s['h3']))
        elif kind=='paragraph':
            sty=s['callout'] if b['text'].startswith('**Alpha rule pending') else s['rule'] if b['text'].startswith('**Default') else s['body']
            story.append(Paragraph(inline(b['text']),sty))
        elif kind=='list':
            for i,item in enumerate(b['items']):
                st=ParagraphStyle('list',parent=s['body'],leftIndent=17,firstLineIndent=-13,spaceAfter=5)
                story.append(Paragraph(('{}.'.format(i+1) if b['ordered'] else '•')+' '+inline(item),st))
            story.append(Spacer(1,5))
        elif kind=='table':story.append(table_flow(b['rows'],s,dark))
        elif kind=='aside':
            for i,line in enumerate(b['paragraphs']):
                style=ParagraphStyle('callout-start',parent=s['callout'],keepWithNext=True) if i==0 and len(b['paragraphs'])>1 else s['callout']
                story.append(Paragraph(inline(line),style))
        elif kind=='index':
            index=TopicIndex();index.levelStyles=[ParagraphStyle('index',parent=s['toc1'],leftIndent=0,firstLineIndent=0,spaceBefore=0)];index.dotsMinLevel=0;index.tableStyle=toc.tableStyle;story.append(index)
        elif kind=='figure':story.append(KeepTogether([Figure(b['name'],dark),Spacer(1,7),Paragraph(inline(FIGURES[b['name']]['caption']),s['small'])]))
    doc.multiBuild(story,maxPasses=5)
    r=PdfReader(dest);all_text='\n'.join(page.extract_text() or '' for page in r.pages)
    if len(doc.pageMap)!=len([b for b in book['blocks'] if b['type']=='heading']):raise ValueError('Missing PDF anchors')
    if any(not (page.extract_text() or '').strip() for page in r.pages):raise ValueError('Empty PDF page')
    audit={'filename':name,'theme':'dark' if dark else 'light','pages':len(r.pages),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'anchors':doc.pageMap,'links':sum(len(page.get('/Annots',[])) for page in r.pages),'words':book['words'],'extractedTextChars':len(all_text)}
    return audit

# Shared base definitions and worked records must remain identical across books.
texts={b['slug']:(ROOT/'docs/publications/manuscripts'/b['file']).read_text() for b in BOOKS}
base=lambda text:text.split('## The primitive reference',1)[1].split('## Worked records',1)[0]
if base(texts['players-handbook'])!=base(texts['srd']):raise ValueError('Cross-book primitive reference drift')
records=lambda text:text.split('## Worked records',1)[1]
if len({records(t) for t in texts.values()})!=1:raise ValueError('Cross-book worked records drift')
manifest=[];web=[]
STATIC=ROOT/'public/books'/VERSION
STATIC.mkdir(parents=True,exist_ok=True)
for meta in BOOKS:
    text=(ROOT/'docs/publications/manuscripts'/meta['file']).read_text()
    if re.search(r'Editorial completeness|Working manuscript|not the complete book',text):raise ValueError('Unfinished manuscript '+meta['slug'])
    book={**meta,'blocks':parse(text)}
    book['headings']=[b for b in book['blocks'] if b['type']=='heading']
    book['words']=len(plain(text).split())
    for theme in (False,True):
        result=build(book,theme);manifest.append({**result,'slug':meta['slug']});(STATIC/result['filename']).write_bytes((OUT/result['filename']).read_bytes())
    web.append({**book,'version':'v0.1 alpha','lightPdf':ORIGIN+'/'+meta['slug']+'.pdf','darkPdf':ORIGIN+'/'+meta['slug']+'-dark.pdf'})
(DATA/'catalogue.json').write_text(json.dumps([{k:b[k] for k in ['slug','short','title','description','accent','version','lightPdf','darkPdf']} for b in web],ensure_ascii=False,indent=2)+'\n')
(DATA/'books.json').write_text(json.dumps(web,ensure_ascii=False,indent=2)+'\n')
(DATA/'figures.json').write_text(json.dumps({k:{'title':v['title'],'caption':v['caption']} for k,v in FIGURES.items()},ensure_ascii=False,indent=2)+'\n')
(ROOT/'docs/publications/release-manifest.json').write_text(json.dumps({'edition':'v0.1 alpha','releaseDate':'2026-10-11','pdfs':manifest},indent=2)+'\n')
print(json.dumps([{'file':a['filename'],'pages':a['pages'],'words':a['words'],'links':a['links']} for a in manifest],indent=2))
