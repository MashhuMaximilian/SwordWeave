"""Print-first illustrated PHB/GM composition, independent of browser layout.

Three embedded platform font roles, mirrored gutters, contextual artwork,
two-column reading, designed case spreads, measured tables and live page refs.
Every source block is consumed; layout failure raises instead of clipping.
"""
from pathlib import Path
import hashlib, html, json, re, math
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Paragraph, Table, TableStyle
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
W,H=558,756
INNER,OUTER,GUTTER=54,39.6,22
CW=W-INNER-OUTER
COL=(CW-GUTTER)/2
TOP,BOTTOM=H-65,52
GOLD=['#9c712d','#d6b25f','#fff0b1','#b88c3d','#efd58d']
SILVER=['#788c8e','#d0dada','#f6f7ee','#8d9e9c']
TEAL=['#296a69','#82bdb0','#d2e8ce','#4e8d82']
_base=json.loads((ROOT/'docs/publications/expanded/art-manifest.json').read_text())['assets']
ART={a['key']:{**a,'path':ROOT/a['printMaster'],'name':a['caption']} for a in _base}
ENCODED_IMAGES={}
def encoded_image(path):
    """Native pixel dimensions; JPEG opaque plates, lossless PNG cutouts.

    This changes PDF storage encoding only. Original artwork masters are retained
    intact; no crop, recoloring, background removal or raster upscaling occurs.
    """
    if path not in ENCODED_IMAGES:
        im=Image.open(path);cache=ROOT/'tmp/pdfs/books/native-jpeg';cache.mkdir(parents=True,exist_ok=True)
        # ReportLab's native JPEG loader bypasses _dataA. Genuine cutouts must
        # retain their PNG color stream and soft mask, not a JPEG reader shim.
        if 'A' in im.getbands() and im.getchannel('A').getextrema()[0]<255:
            ENCODED_IMAGES[path]=ImageReader(path)
            return ENCODED_IMAGES[path]
        target=cache/(hashlib.sha256(Path(path).read_bytes()).hexdigest()+'.jpg')
        if not target.exists():im.convert('RGB').save(target,'JPEG',quality=92,subsampling=0,optimize=True)
        reader=ImageReader(str(target));reader.getRGBData()
        ENCODED_IMAGES[path]=reader
    return ENCODED_IMAGES[path]
for a in json.loads((ROOT/'docs/publications/print-edition/new-art.json').read_text())['assets']:
    ART[a['key']]={**a,'path':ROOT/a['printMaster'],'name':a['role']}
for a in json.loads((ROOT/'docs/publications/print-edition/reused-art.json').read_text())['assets']:
    ART[a['key']]={**a,'path':ROOT/a['printMaster']}
for a in json.loads((ROOT/'output/monster-art-2026-10/inventory.json').read_text()):
    path=ROOT/'output/monster-art-2026-10'/(a['key']+'-master.png')
    if path.exists():ART[a['key']]={**a,'path':path,'transparent':False}

CHAPTER_ART={
 'read-make-play':('party-cutout','Three different contributions can make one shared plan.'),
 'begin-a-shared-story':('bridge','A rescue begins with a person, a place and a choice.'),
 'make-someone-you-want-to-play':('party-cutout','A person can grow through many methods.'),
 'read-and-compose-your-abilities':('workshop','Owned ingredients become readable workings.'),
 'resolve-uncertainty':('tools','The actual method and tools help establish the stakes.'),
 'act-together-in-combat':('bridge','The party coordinates distinct intentions.'),
 'push-the-limits':('watcher','Agree the scope of an extraordinary attempt.'),
 'keep-a-working-alive':('watcher','Continuation is a requirement, not always a damage payment.'),
 'survive-and-carry-consequences':('camp','Recovery includes care, safety and agreed rest.'),
 'equipment-and-growth':('tools','Equipment has its own ledger and practical purpose.'),
 'your-first-scene-step-by-step':('bridge','The group changes a situation through connected choices.'),
 'three-people-three-starting-builds':('party-cutout','These people are examples, not prescribed classes.'),
 'a-construction-workshop':('workshop','Clear ingredients let another reader understand the working.'),
 'adventures-beyond-a-fight':('mossback-grazer','The herd needs a safe crossing; combat is only one response.'),
 'consequences-you-can-understand':('camp','A consequence has an actual change and an ending.'),
 'keep-your-character-growing':('tools','New acquisitions can support an existing purpose.'),
 'questions-players-often-ask':('party-cutout','Ask about the actual situation before choosing a procedure.'),
 'follow-a-whole-encounter':('watcher','The Canal Watcher protects the spawning bed.'),
 'translate-a-fantasy-into-purchases':('workshop','Buy the actual rule, then organize its references.'),
 'learn-the-families-by-making-decisions':('tools','Different ingredients answer different questions.'),
 'test-targeting-and-conditions-at-the-table':('lanternblind-mole','A sense must actually locate a subject.'),
 'follow-advancement-through-the-ledger':('tools','Record each acquisition once.'),
 'play-a-day-without-a-battle':('waxseal-witness','Evidence, obligations and cooperation can carry a session.'),
 'practice-with-answers':('party-cutout','Try an interpretation, then compare the worked explanation.'),
 'carry-a-useful-table-record':('tools','A small record keeps the next decision clear.'),
 'begin-with-a-playable-situation':('gm-cover','Give the world motives, routes and visible opportunities.'),
 'make-rulings-people-can-understand':('tools','Agree what changes before someone commits.'),
 'direct-a-shared-round':('custodian-cutout','Resolve the scene through Council, Fast, Measured and Heavy.'),
 'review-creations-and-choose-consequences':('workshop','A creation is reviewed by what it actually changes.'),
 'build-creatures-that-change-the-scene':('custodian-cutout','Purpose and behavior make a creature useful.'),
 'prepare-encounters-around-choices':('mossback-grazer','A herd at a ford creates choices beyond damage.'),
 'consequences-recovery-and-continued-play':('camp','Return to play with an intelligible continuing record.'),
 'build-adventures-from-what-people-do':('gm-cover','A place offers routes, evidence and changing relationships.'),
 'prepare-a-first-session-people-can-enter':('bridge','Present enough visible facts for a first useful choice.'),
 'a-workshop-in-understandable-rulings':('tools','Read the method and its stakes together.'),
 'creatures-from-a-purpose-to-a-record':('custodian-cutout','The mechanics serve this guardian’s actual purpose.'),
 'run-an-encounter-through-its-whole-life':('watcher','Preparation, play and aftermath have different records.'),
 'adventure-the-gate-that-will-not-open':('mossback-grazer','Water, access and a protected ford are shared concerns.'),
 'adventure-the-bellhouse-of-borrowed-names':('custodian-cutout','The bellhouse has a mechanism and a custodian to understand.'),
 'build-a-campaign-that-can-respond':('waxseal-witness','People remember what the party changes.'),
 'watch-the-decisions-inside-a-whole-encounter':('watcher','Follow the actual state between decisions.'),
 'design-pressure-that-offers-useful-choices':('tidegate-crab','A blocked passage can be approached in several ways.'),
 'from-an-idea-to-an-adventure-someone-else-can-run':('gm-cover','Connect locations with facts another GM can use.'),
 'price-an-idea-by-reading-what-it-changes':('workshop','Permission, expression and limitation each matter.'),
 'give-consequences-a-shape-people-can-live-with':('camp','State who is affected, how and until when.'),
 'run-places-conversations-and-journeys-with-confidence':('tools','Ordinary routes and resources remain part of the game.'),
 'keep-a-small-reliable-record-at-the-table':('tools','Track what affects the next choice.'),
 'public-sample-encounters':('mossback-grazer','Templates are examples to adapt to the actual party and place.'),
}

# The closing illustration has a specific teaching subject; it is never selected
# by random index or by a need to fill a particular amount of white space.
TAIL_ART={
 'begin-a-shared-story':('harbor-rope-hand','Harbor Rope Hand: learned practical methods support a shared plan.'),
 'make-someone-you-want-to-play':('skyborn','Skyborn: a lineage describes an actual body and authored permissions. It is not a fixed class.'),
 'read-and-compose-your-abilities':('artificer','Artificer: a working names its ingredients and what they change.'),
 'resolve-uncertainty':('village-mediator','Village Mediator: credible words and circumstances establish the approach.'),
 'act-together-in-combat':('signal-captain','Signal Captain: coordination begins with real intentions at Council.'),
 'push-the-limits':('elemental-shaper','Elemental Shaper: the subject and scope of a working remain explicit.'),
 'keep-a-working-alive':('guardian','Guardian: the continuing protection has an agreed scope and requirement.'),
 'survive-and-carry-consequences':('field-surgeon-apprentice','Field Surgeon Apprentice: care, stabilization and healing are different changes.'),
 'equipment-and-growth':('tools','Record carried Load, equipped slots and Item BU separately.'),
 'three-people-three-starting-builds':('human','Human lineage illustration. The named teaching characters are separate original examples.'),
 'a-construction-workshop':('terrain-architect','Terrain Architect: a structure needs an understandable boundary.'),
 'adventures-beyond-a-fight':('beast-handler-s-aide','Beast Handler’s Aide: practical cooperation can change an encounter.'),
 'consequences-you-can-understand':('agreement-recorder','Agreement Recorder: record the change, timing and ending.'),
 'keep-your-character-growing':('ironborn','Ironborn: an acquired improvement should serve the person’s actual method.'),
 'translate-a-fantasy-into-purchases':('toneweft','Toneweft: distinguish a subject, a sense and a communication permission.'),
 'learn-the-families-by-making-decisions':('mirebody','Mirebody: a bodily exception has its own actual scope.'),
 'test-targeting-and-conditions-at-the-table':('lantern-eyed','Lantern-Eyed: having a sense and locating this subject remain separate questions.'),
 'follow-advancement-through-the-ledger':('archive-conservator','Archive Conservator: a useful record preserves the actual acquisition.'),
 'play-a-day-without-a-battle':('cartographer-s-apprentice','Cartographer’s Apprentice: routes are knowledge to examine, not automatic certainty.'),
 'carry-a-useful-table-record':('tools','Keep the facts that can change your next decision.'),
 'make-rulings-people-can-understand':('treaty-envoy','Treaty Envoy: the agreed words need an actual scope and consequence.'),
 'direct-a-shared-round':('signal-captain','Signal Captain: read dependencies before placing their resolution.'),
 'review-creations-and-choose-consequences':('artificer','Artificer: inspect the actual construction before agreeing a price.'),
 'build-creatures-that-change-the-scene':('hollowbark-listener','Hollowbark Listener: a creature’s senses can change useful choices.'),
 'prepare-encounters-around-choices':('currentglass-ray','Currentglass Ray: location and movement matter alongside a budget.'),
 'consequences-recovery-and-continued-play':('rescue-diver','Rescue Diver: reaching someone, stabilizing them and restoring Vitality are distinct.'),
 'build-adventures-from-what-people-do':('weather-watcher','Weather Watcher: visible conditions let the party make useful plans.'),
 'a-workshop-in-understandable-rulings':('longshot','Longshot: establish a located target, delivery path and actual cover.'),
 'creatures-from-a-purpose-to-a-record':('custodian-cutout','Counterweight Custodian: this illustration shows a particular guardian, not every construct.'),
 'run-an-encounter-through-its-whole-life':('velvet-oath-broker','Velvet Oath Broker: opposition can negotiate and remember an agreement.'),
 'adventure-the-bellhouse-of-borrowed-names':('bell-foundry-worker','Bell Foundry Worker: the place has materials, sound and practical work.'),
 'build-a-campaign-that-can-respond':('agreement-recorder','Agreement Recorder: earlier choices remain facts people can act on.'),
 'design-pressure-that-offers-useful-choices':('quarry-rigger','Quarry Rigger: preparation offers another way to meet the pressure.'),
 'price-an-idea-by-reading-what-it-changes':('claymold','Claymold: transformation describes an actual boundary and result.'),
 'give-consequences-a-shape-people-can-live-with':('field-surgeon-apprentice','Field Surgeon Apprentice: name the consequence and its route back to play.'),
 'run-places-conversations-and-journeys-with-confidence':('cartographer-s-apprentice','Cartographer’s Apprentice: preserve routes, evidence and useful uncertainties.'),
 'keep-a-small-reliable-record-at-the-table':('tools','Write what affects the next choice; leave room for what changes.'),
}
for chapter,(key,caption) in list(TAIL_ART.items()):
    spot={'skyborn':'skyborn-cutout','guardian':'guardian-cutout','field-surgeon-apprentice':'surgeon-cutout','artificer':'artificer-cutout'}.get(key)
    if spot in ART:TAIL_ART[chapter]=(spot,caption)

def plain(s):return re.sub(r'\[([^]]+)\]\([^)]+\)',r'\1',s).replace('**','').replace('`','').replace('*','')
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower().replace('’','').replace("'",'')).strip('-')
def palette(dark):
    return {'paper':'#101f23' if dark else '#faf7ee','ink':'#f0eee2' if dark else '#171c1d','gold':'#efcf83' if dark else '#795619','teal':'#9ccabc' if dark else '#2c6662','muted':'#bed0c9' if dark else '#566561','line':'#5a7473' if dark else '#bec8bc','panel':'#1a3032' if dark else '#edf0e5'}
def gradient(c,x,y,w,h,stops):
    c.saveState()
    steps=110
    for i in range(steps):
        t=i/(steps-1)*(len(stops)-1);a=int(t);b=min(a+1,len(stops)-1);q=t-a
        ca=colors.HexColor(stops[a]);cb=colors.HexColor(stops[b]);c.setFillColor(colors.Color(ca.red*(1-q)+cb.red*q,ca.green*(1-q)+cb.green*q,ca.blue*(1-q)+cb.blue*q));c.rect(x+w*i/steps,y,w/steps+.05,h,stroke=0,fill=1)
    c.restoreState()

def styles(dark):
    p=palette(dark)
    body=ParagraphStyle('print-body',fontName='Body',fontSize=12.1,leading=15.6,textColor=colors.HexColor(p['ink']),spaceAfter=6,allowWidows=0,allowOrphans=0)
    return {'body':body,'small':ParagraphStyle('print-small',parent=body,fontSize=10.1,leading=12.7,textColor=colors.HexColor(p['muted'])),'h3':ParagraphStyle('print-h3',fontName='Bold',fontSize=12.5,leading=15.6,textColor=colors.HexColor(p['gold']),spaceBefore=11,spaceAfter=6,keepWithNext=True),'h2':ParagraphStyle('print-h2',fontName='Display',fontSize=28,leading=30,textColor=colors.HexColor(p['ink']),spaceAfter=14),'cell':ParagraphStyle('print-cell',parent=body,fontSize=11,leading=13.3,spaceAfter=0),'headcell':ParagraphStyle('print-headcell',fontName='Bold',fontSize=8.6,leading=11.8,textColor=colors.HexColor(p['teal']),spaceAfter=0),'label':ParagraphStyle('print-label',fontName='Bold',fontSize=7.8,leading=10.5,textColor=colors.HexColor(p['teal'])),'toc':ParagraphStyle('print-toc',fontName='Body',fontSize=12,leading=15.6,textColor=colors.HexColor(p['ink']))}

def inline(s,refs,dark):
    s=s.replace('—','-').replace('–','-').replace('‑','-').replace('−','-').replace('→',' then ').replace('↔',' / ').replace('√','sqrt').replace('≥','at least').replace('ΔCV','delta CV').replace('Δ','delta')
    s=html.escape(s,quote=False)
    def link(m):
        text,target=m.group(1),m.group(2);color=palette(dark)['teal'];page=refs.get(target[1:]) if target.startswith('#') else None
        return f'<a href="{target}" color="{color}">{text}</a>'+ (f' <font size="8">(p. {page})</font>' if page else '')
    s=re.sub(r'\[([^]]+)\]\((https?://[^)]+|#[^)]+)\)',link,s)
    s=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'\1',s)
    return s.replace('`','')

def table_text(text):
    # Joined practice names are labels, not one long word. Supply ordinary
    # break opportunities while preserving URLs and Markdown destinations.
    parts=re.split(r'(\[[^]]+\]\([^)]+\)|https?://\S+)',text)
    return ''.join(part if part.startswith(('http://','https://','[')) else
        re.sub(r'([A-Za-z])/(?=[A-Za-z])',r'\1 / ',part) for part in parts)

class Layout:
    def __init__(self,book,dark,refs=None):
        self.book=book;self.dark=dark;self.p=palette(dark);self.s=styles(dark);self.refs=refs or {};self.pages=[];self.marks={};self.chapter=book['short'];self.chapter_key=None;self.placements=[];self.new_page()
    def new_page(self,kind='reading',frames=None):
        if self.pages and not self.pages[-1]['ops']:self.pages.pop()
        n=len(self.pages)+1;left=INNER if n%2 else OUTER
        self.page={'kind':kind,'chapter':self.chapter,'ops':[],'left':left,'number':n};self.pages.append(self.page)
        self.frames=frames or [[left,TOP,COL,BOTTOM],[left+COL+GUTTER,TOP,COL,BOTTOM]]
        self.fi=0;self.y=self.frames[0][1]
    def op(self,kind,*args):self.page['ops'].append((kind,args))
    def mark(self,ident,title,level):
        if ident in self.marks:raise ValueError('Duplicate print destination '+ident)
        self.marks[ident]=self.page['number'];self.op('mark',ident,title,level,self.y)
    def advance(self):
        self.fi+=1
        if self.fi>=len(self.frames):
            full=len(self.frames)==1 and self.frames[0][2]>COL+1
            self.new_page('reference table' if full else 'reading')
            if full:self.frames=[[self.page['left'],TOP,CW,BOTTOM]];self.y=TOP
        else:self.y=self.frames[self.fi][1]
    def flow(self,f,gap=6):
        while True:
            x,top,w,bottom=self.frames[self.fi];avail=self.y-bottom
            fw,fh=f.wrap(w,max(0,avail))
            before=f.getSpaceBefore()
            if before and self.y<top:avail-=before
            if fh<=avail+.01 and (not f.getKeepWithNext() or fh+46<=avail):
                self.y-=before if self.y<top else 0;self.op('flow',f,x,self.y-fh,w,fh);self.y-=fh+gap;return
            # Keep a heading with at least three following body lines.
            if f.getKeepWithNext() or avail<self.s['body'].leading*3:
                self.advance();continue
            pieces=f.split(w,max(0,avail))
            if pieces:
                first=pieces[0];_,h=first.wrap(w,avail);self.op('flow',first,x,self.y-h,w,h);self.y-=h+gap
                for rest in pieces[1:]:self.advance();self.flow(rest,gap)
                return
            if abs(self.y-top)<.1:raise ValueError(f'Unplaceable print object: {type(f).__name__} {fw} x {fh}, frame {w} x {top-bottom}')
            self.advance()
    def para(self,text,style='body',gap=6):self.flow(Paragraph(inline(text,self.refs,self.dark),self.s[style]),gap)
    def heading(self,b):
        if b['level']==2:
            # A small carryover belongs beside the next teaching section, not
            # alone on a mostly empty page. Keep the two reading frames intact.
            can_continue=(bool(self.page['ops']) and self.page['kind']=='reading' and len(self.frames)==2 and
                ((self.fi==0 and self.frames[0][1]-self.y<180) or
                 (self.fi==1 and self.y-self.frames[1][3]>310)))
            if can_continue:
                if self.fi==0:
                    subject=TAIL_ART.get(self.chapter_key)
                    if subject:
                        key,caption=subject;x,top,w,bottom=self.frames[0];ah=min(350,self.y-bottom-55)
                        if ah>160:
                            self.art(key,x,self.y-ah-12,w,ah,'section closing illustration')
                            q=Paragraph(html.escape(caption),self.s['small']);_,hh=q.wrap(w,80);self.op('flow',q,x,self.y-ah-hh-20,w,hh)
                    self.fi=1;self.y=self.frames[1][1]
                self.chapter=plain(b['text']);self.chapter_key=b['id'];self.page['chapter']=self.chapter
                self.mark(b['id'],plain(b['text']),0)
                self.y-=12
                f=Paragraph(inline(b['text'],self.refs,self.dark),ParagraphStyle('continued-section',parent=self.s['h2'],fontSize=23,leading=25,keepWithNext=True))
                self.flow(f,14)
                return
            self.finish_tail()
            self.chapter=plain(b['text']);self.chapter_key=b['id'];self.new_page('chapter')
            self.mark(b['id'],plain(b['text']),0)
            left=self.page['left'];label='REFERENCE' if 'reference' in b['id'] else 'SWORDWEAVE / '+self.book['short'].upper()
            self.op('label',label,left,TOP+14)
            h=Paragraph(inline(b['text'],self.refs,self.dark),self.s['h2']);_,hh=h.wrap(CW,100);self.op('flow',h,left,TOP-hh,CW,hh)
            top=TOP-hh-20
            key,caption=CHAPTER_ART.get(b['id'],(None,None))
            if key:
                a=ART[key]
                if key in ['bridge','workshop','camp']:
                    ah=290;self.art(key,left,top-ah,CW,ah,'chapter narrative plate',crop=False)
                    cp=Paragraph(html.escape(caption),self.s['small']);_,ch=cp.wrap(CW,40);self.op('flow',cp,left,top-ah-ch-5,CW,ch);top-=ah+ch+20
                    self.frames=[[left,top,COL,BOTTOM],[left+COL+GUTTER,top,COL,BOTTOM]]
                else:
                    ah=min(240,TOP-hh-100);self.art(key,left+COL+GUTTER,top-ah,COL,ah,'chapter subject',crop=False)
                    cp=Paragraph(html.escape(caption),self.s['small']);_,ch=cp.wrap(COL,80);self.op('flow',cp,left+COL+GUTTER,top-ah-ch-5,COL,ch)
                    self.frames=[[left,top,COL,BOTTOM],[left+COL+GUTTER,top-ah-ch-20,COL,BOTTOM]]
            elif b['id']=='the-primitive-reference':self.frames=[[left,top,CW,BOTTOM]]
            else:self.frames=[[left,top,COL,BOTTOM],[left+COL+GUTTER,top,COL,BOTTOM]]
            self.fi=0;self.y=self.frames[0][1]
        else:self.section_heading(b['text'],b['id'])
    def section_heading(self,title,ident):
        f=Paragraph(inline(title,self.refs,self.dark),self.s['h3'])
        _,top,w,bottom=self.frames[self.fi];_,h=f.wrap(w,200)
        before=f.getSpaceBefore() if self.y<top else 0
        if self.y-bottom<h+before+60:self.advance()
        self.mark(ident,plain(title),1);self.flow(f,6)
    def art(self,key,x,y,w,h,role,crop=False):
        a=ART[key];im=Image.open(a['path']);iw,ih=im.size
        if not crop:
            scale=min(w/iw,h/ih);aw,ah=iw*scale,ih*scale;x+=(w-aw)/2;y+=(h-ah)/2;w,h=aw,ah
        self.op('image',str(a['path']),x,y,w,h,crop)
        self.placements.append({'page':self.page['number'],'key':key,'role':role,'nativePixels':[iw,ih],'sizePoints':[round(w,2),round(h,2)],'effectivePpi':round(min(iw/(w/72),ih/(h/72)),1),'transparent':a.get('transparent',False)})
    def finish_tail(self):
        # Place the reviewed subject alongside the chapter's final explanation.
        if not self.chapter_key or self.fi>=len(self.frames):return
        if self.page['kind'] not in ['reading','chapter']:return
        subject=TAIL_ART.get(self.chapter_key)
        if not subject:return
        key,caption=subject
        if any(a['page']==self.page['number'] and a['key']==key for a in self.placements):return
        if self.fi==0 and len(self.frames)>1:
            x,top,w,b=self.frames[1];available=top-b;anchor=top
        else:x,top,w,b=self.frames[self.fi];available=self.y-b;anchor=self.y-12
        if available<195:return
        ah=min(330,available-60)
        self.art(key,x,anchor-ah,w,ah,'chapter closing subject')
        q=Paragraph(html.escape(caption),self.s['small']);_,hh=q.wrap(w,80)
        self.op('flow',q,x,anchor-ah-hh-8,w,hh)
    def full_page(self,title,kind='reference',ident=None):
        self.finish_tail();self.chapter=title;self.new_page(kind);left=self.page['left']
        if ident:self.mark(ident,title,0)
        self.op('label','SWORDWEAVE / '+kind.upper(),left,TOP+14)
        q=Paragraph(html.escape(title),self.s['h2']);_,h=q.wrap(CW,100);self.op('flow',q,left,TOP-h,CW,h);top=TOP-h-18
        self.frames=[[left,top,CW,BOTTOM]];self.fi=0;self.y=top
    def table(self,rows,heading=None):
        n=len(rows[0]);wide=n>2 or any(len(plain(v))>130 for row in rows for v in row)
        if wide:
            if (self.page['kind']=='reading' and len(self.frames)==2 and self.fi==0
                and self.frames[0][1]-self.y<180
                and not any(op[0]=='image' for op in self.page['ops'])
                and all(op[1][3]<=COL+.1 for op in self.page['ops'] if op[0]=='flow')):
                # Promote a short carryover to the wide frame before its table,
                # so a few final lines cannot become an isolated extra page.
                left=self.page['left'];yy=self.frames[0][1];ops=[]
                for kind,args in self.page['ops']:
                    if kind=='flow':
                        f,x,y,w,h=args;_,hh=f.wrap(CW,1000);ops.append((kind,(f,left,yy-hh,CW,hh)));yy-=hh+6
                    else:ops.append((kind,args))
                self.page['ops']=ops;self.frames=[[left,self.frames[0][1],CW,BOTTOM]];self.fi=0;self.y=yy
            if len(self.frames)==1 and self.frames[0][2]>COL+1 and self.y-BOTTOM>120:
                if heading:self.heading(heading)
            elif heading and heading['level']==2:self.full_page(plain(heading['text']),'reference table',heading['id']);self.chapter_key=heading['id']
            else:
                self.full_page(self.chapter,'reference table')
                if heading:self.heading(heading)
        width=self.frames[self.fi][2]
        if n==2:
            # Questions and other long labels need a real reading column;
            # the short-label reference ratio can split ordinary words.
            ratios=[.42,.58] if max(len(plain(r[0])) for r in rows)>22 else [.30,.70]
        else:
            lengths=[max(len(plain(r[j])) for r in rows) for j in range(n)]
            weights=[max(6,math.sqrt(min(l,240))) for l in lengths];ratios=[v/sum(weights) for v in weights]
        data=[[Paragraph(inline(table_text(c),self.refs,self.dark),self.s['headcell'] if i==0 else self.s['cell']) for c in row]for i,row in enumerate(rows)]
        t=Table(data,colWidths=[width*r for r in ratios],repeatRows=1,hAlign='LEFT',splitByRow=1)
        t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),6),('BACKGROUND',(0,0),(-1,0),colors.HexColor(self.p['panel'])),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor(self.p['paper']),colors.HexColor(self.p['panel'])]),('LINEBELOW',(0,0),(-1,0),.8,colors.HexColor(self.p['gold'])),('LINEBELOW',(0,1),(-1,-1),.22,colors.HexColor(self.p['line']))]))
        self.flow(t,12)
        if wide:
            top=self.y-8;left=self.page['left']
            if top-BOTTOM<90:self.new_page()
            else:self.frames=[[left,top,COL,BOTTOM],[left+COL+GUTTER,top,COL,BOTTOM]];self.fi=0;self.y=top
    def cover(self):
        self.pages=[];self.new_page('cover',[[18,H-18,W-36,18]])
        key='phb-cover' if self.book['slug']=='players-handbook' else 'gm-cover'
        self.art(key,18,18,W-36,H-36,'cover',crop=False)
        self.op('cover',self.book['title'],self.book['subtitle']);self.new_page('colophon')
        self.full_page('A shared framework. A book to use.','colophon','publication')
        for text in [f'**SwordWeave {self.book["title"]}** - v0.1 alpha. Illustrated print edition, revision 2. Marius Ion. October 2026.',
          'This free book is a complete teaching companion to the SwordWeave construction and play framework. Read it with your group, use the worked examples, and return to its references when a question matters at the table.',
          'Original rules, designated explanatory text and instructional diagrams are CC BY 4.0. Attribute SwordWeave and link to swordweave.quest when reusing that material. Illustrations, logo and other assets have separate notices; the text license does not silently license those assets.',
          'Artwork is original SwordWeave illustration generated with OpenAI tools under Marius Ion’s direction. Existing character, heritage and creature illustrations retain their subjects. No artwork from the reference games has been reproduced.',
          'Fonts: Aubrey, Syne and Unica One, under the SIL Open Font License. Gold, silver and teal sheens are simulated with printed color. This light edition is composed for paper; the dark edition preserves its layout for reading on screen.',
          '**Alpha boundary.** Additional Vitality-paid upkeep triggered by incoming damage remains undecided. Its threshold, damage counter and reset policy are not imposed by this edition. Ordinary agreed continuation requirements still apply.',
          'These examples show decisions at particular tables. Their scene-specific DCs, consequences and permissions are not universal prices or difficulty categories. Rule labels, defaults and optional advice are kept distinct.',
          'Free downloads, living documentation and playable examples: [swordweave.quest/books](https://www.swordweave.quest/books). You can play from paper records; an account is not required to understand or use the rules.'
        ]:self.para(text,gap=14)
        self.art('tools',self.page['left']+CW-155,63,155,155,'colophon tools')
    def contents(self,heads):
        self.full_page('Contents','contents','contents')
        self.para('Read the teaching chapters in order, or find a subject by its page number. The final topic index includes the smaller sections.','small',12)
        left=self.page['left'];self.frames=[[left,self.y,COL,BOTTOM],[left+COL+GUTTER,self.y,COL,BOTTOM]];self.fi=0
        for b in heads:
            if b['level']!=2:continue
            n=self.refs.get(b['id'],'—');q=Paragraph(f'<a href="#{b["id"]}">{html.escape(plain(b["text"]))}</a>',self.s['toc']);_,h=q.wrap(COL-25,80)
            if self.y-h<BOTTOM:
                self.advance();self.page['kind']='contents'
            x=self.frames[self.fi][0];self.op('flow',q,x,self.y-h,COL-25,h);self.op('folio-link',str(n),b['id'],x+COL,self.y-h+3);self.y-=h+7
    def figure(self,key,definition,heading=None):
        self.full_page(plain(heading['text']) if heading else definition['title'],'teaching diagram',heading['id'] if heading else None)
        if heading:
            self.chapter_key=heading['id'];self.para(definition['title'],'h3',8)
        self.para(definition['caption'],'body',18)
        height=345 if key=='composition' else 330
        self.op('diagram',key,definition,self.page['left'],self.y-height,CW,height);self.y-=height+15
        subject={'composition':'artificer-cutout','rhythm':'party-cutout','access':'elemental-shaper','recovery':'surgeon-cutout','consequence':'agreement-recorder','budgets':'tools','intent':'bridge'}[key]
        ah=min(155,self.y-BOTTOM-14)
        if ah>85:
            self.art(subject,self.page['left'],BOTTOM+5,CW*.45,ah,'diagram teaching subject')
            notes={
              'composition':'Read a line as “uses this owned rule.” Count the acquisition in its ledger once; its repeated appearance is a reference.',
              'rhythm':'The shared rhythm makes dependencies visible. A fast rope placement can let a measured crossing happen; no initiative roll is needed.',
              'access':'Describe the actual behavior first. A larger payment can scale an eligible working; it cannot purchase a missing permission during the attempt.',
              'recovery':'Agree that a rest qualifies. Its duration alone does not apply the recovery; the table can agree a partial result.',
              'consequence':'The record should help the next decision. A condition name alone does not import a package of restrictions.',
              'budgets':'These are example amounts, not a difficulty label. Terrain, motives, concentration, control and support still matter.',
              'intent':'The changed situation becomes the starting point for the next choice. The table can revise the attempt before committing.'}
            q=Paragraph(inline(notes[key],self.refs,self.dark),self.s['body']);_,hh=q.wrap(CW*.50,ah)
            self.op('flow',q,self.page['left']+CW*.50,BOTTOM+ah-hh,CW*.50,hh)
        self.new_page()
    def worksheet(self,key,definition,ident=None):
        title,fields=definition;self.full_page(title,'table sheet',ident)
        self.para('Optional working sheet. Copy or print for your own table. It records your decisions and actual rules.','small',15)
        h=(self.y-BOTTOM)/len(fields)
        for label,hint in fields:
            self.para('**'+label+'**',gap=2);self.para(hint,'small',2)
            self.op('write-lines',self.page['left'],self.y-h+43,CW,h-49);self.y-=h-38
        self.new_page()
    def atlas(self,modules):
        for i,m in enumerate(modules):
            ident='field-atlas-'+m.get('id',slug(m['title']));self.chapter=m['title'];self.new_page('field atelier');self.mark(ident,m['title'],0)
            x=self.page['left'];self.op('label',m['kicker']+' / WORKED EXAMPLE',x,TOP+14)
            q=Paragraph(html.escape(m['title']),self.s['h2']);_,h=q.wrap(CW,90);self.op('flow',q,x,TOP-h,CW,h);top=TOP-h-18
            key=m['artKey'];key=key if key in ART else 'tools'
            atelier_style=ParagraphStyle('atelier-body',parent=self.s['body'],fontSize=11.8,leading=15.1)
            first_cost=sum(Paragraph(s['title'],self.s['h3']).wrap(COL,200)[1]+Paragraph(inline(s['text'],self.refs,self.dark),atelier_style).wrap(COL,10000)[1]+26 for s in m['sections'][:2])
            fact_height=sum(Paragraph(f['label'],self.s['label']).wrap(CW-296,150)[1]+Paragraph(f['value'],self.s['body']).wrap(CW-296,200)[1]+31 for f in m.get('quickFacts',[]))
            base_available=top-267-BOTTOM
            band=max(fact_height+10,min(246,246-max(0,first_cost/2-base_available+12)))
            self.art(key,x,top-band,276,band,m['imagePurpose'],crop=False)
            self.op('atlas-facts',m.get('quickFacts',[]),x+296,top, CW-296)
            top-=band+21
            self.frames=[[x,top,COL,BOTTOM],[x+COL+GUTTER,top,COL,BOTTOM]];self.fi=0;self.y=top
            sections=m['sections'];first=sections[:2];rest=sections[2:]
            for j,section in enumerate(first):
                self.section_heading(section['title'],ident+'-section-'+str(j+1));self.flow(Paragraph(inline(section['text'],self.refs,self.dark),atelier_style),9)
            self.new_page('field atelier');x=self.page['left'];self.op('label',m['kicker']+' / AT THE TABLE',x,TOP+14)
            self.op('atelier-heading',m['title'],x,TOP)
            self.frames=[[x,TOP-45,COL,BOTTOM],[x+COL+GUTTER,TOP-45,COL,BOTTOM]];self.fi=0;self.y=TOP-45
            for j,section in enumerate(rest,3):
                self.section_heading(section['title'],ident+'-section-'+str(j));self.flow(Paragraph(inline(section['text'],self.refs,self.dark),atelier_style),9)
            # A compact related spot belongs to the same module, never a random creature.
            if self.y-BOTTOM>150:
                fx,ft,fw,fb=self.frames[self.fi];self.art(key,fx,fb+10,fw,min(170,self.y-fb-15),'same-subject closing detail',crop=False)
        self.new_page()
    def index(self,heads,introduction=None):
        self.full_page('Topic index','topic index','topic-index')
        for text in introduction or []:self.para(text,'small',10)
        self.frames=[[self.page['left'],self.y,COL,BOTTOM],[self.page['left']+COL+GUTTER,self.y,COL,BOTTOM]];self.fi=0
        for b in sorted(heads,key=lambda b:plain(b['text']).casefold()):
            if b['id']=='topic-index':continue
            title=plain(b['text']);n=self.refs.get(b['id'],'-');self.para(f'[{title}](#{b["id"]}) **{n}**','small',6)
    def render(self,dest):
        # Remove only unused transitional frames, not intentional content pages.
        self.pages=[p for p in self.pages if p['ops']]
        c=canvas.Canvas(str(dest),pagesize=(W,H),pageCompression=1,invariant=1)
        c.setTitle('SwordWeave '+self.book['title']+' - v0.1 alpha - illustrated print edition');c.setAuthor('Marius Ion');c.setSubject('Free rules and explanatory text: CC BY 4.0; artwork notices separate.');c.setViewerPreference('DisplayDocTitle','true')
        for page in self.pages:
            self.draw_background(c,page)
            for kind,args in page['ops']:self.draw(c,kind,args)
            c.showPage()
        c.save()
    def draw_background(self,c,page):
        c.setFillColor(colors.HexColor(self.p['paper']));c.rect(0,0,W,H,fill=1,stroke=0)
        if page['kind']=='cover':return
        left=page['left'];right=left+CW
        gradient(c,left,H-38,CW,1,GOLD if page['kind'] in ['field atelier','chapter'] else SILVER)
        c.setFont('Bold',6.7);c.setFillColor(colors.HexColor(self.p['muted']));c.drawString(left,H-28,'SWORDWEAVE  /  '+self.book['short'].upper())
        title=page['chapter'];q=Paragraph(html.escape(title),ParagraphStyle('running',fontName='Body',fontSize=8.6,leading=10,textColor=colors.HexColor(self.p['muted']),alignment=2));_,h=q.wrap(CW-140,30);q.drawOn(c,right-(CW-140),H-29-h+8)
        c.setLineWidth(.35);c.setStrokeColor(colors.HexColor(self.p['line']));c.line(left,37,right,37)
        c.setFont('Bold',7);c.setFillColor(colors.HexColor(self.p['muted']));c.drawString(left,24,'v0.1 alpha');c.drawRightString(right,24,str(page['number']))
        # An understated faceted metal folio, outside the reading area.
        edge=W-16 if page['number']%2 else 12
        gradient(c,edge,24,4,18,TEAL+GOLD)
    def draw(self,c,kind,args):
        if kind=='flow':
            f,x,y,w,h=args;f.wrap(w,h);f.drawOn(c,x,y)
        elif kind=='image':
            path,x,y,w,h,crop=args;c.saveState()
            if crop:
                p=c.beginPath();p.rect(x,y,w,h);c.clipPath(p,stroke=0,fill=0);im=Image.open(path);scale=max(w/im.width,h/im.height);dw,dh=im.width*scale,im.height*scale;c.drawImage(encoded_image(path),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto')
            else:c.drawImage(encoded_image(path),x,y,w,h,mask='auto')
            c.restoreState()
        elif kind=='mark':
            ident,title,level,y=args;c.bookmarkHorizontalAbsolute(ident,y);c.addOutlineEntry(title,ident,level=level,closed=bool(level))
        elif kind=='label':
            text,x,y=args;c.setFillColor(colors.HexColor(self.p['teal']));c.setFont('Bold',7.3);c.drawString(x,y,text)
        elif kind=='folio-link':
            text,target,x,y=args;c.setFont('Bold',9);c.setFillColor(colors.HexColor(self.p['gold']));c.drawRightString(x,y,text);c.linkRect('',target,(x-25,y-2,x,y+10),relative=0,thickness=0)
        elif kind=='cover':
            title,subtitle=args;c.saveState();c.setFillColor(colors.HexColor('#0d2529'));c.setFillAlpha(.92);c.rect(35,H-158,W-70,124,fill=1,stroke=0);c.setFillAlpha(1)
            gradient(c,35,H-161,W-70,3,TEAL+GOLD);c.setFont('Display',43);c.setFillColor(colors.HexColor('#f5dfa0'));c.drawCentredString(W/2,H-77,'SWORD·WEAVE')
            p=Paragraph(html.escape(title),ParagraphStyle('cover-title',fontName='Display',fontSize=29,leading=30,textColor=colors.HexColor('#f3f1df'),alignment=1));_,h=p.wrap(W-85,80);p.drawOn(c,42.5,H-91-h)
            c.setFont('Bold',8);c.setFillColor(colors.HexColor('#b8d8c8'));c.drawCentredString(W/2,H-147,'v0.1 alpha  /  ILLUSTRATED CORE BOOK')
            c.setFillColor(colors.HexColor('#0d2529'));c.setFillAlpha(.94);c.rect(35,33,W-70,34,fill=1,stroke=0);c.setFillAlpha(1);c.setFont('Bold',8);c.setFillColor(colors.HexColor('#efd391'));c.drawCentredString(W/2,47,'MARIUS ION  /  SWORDWEAVE.QUEST');c.restoreState()
        elif kind=='atelier-heading':
            title,x,y=args;p=Paragraph(html.escape(title),ParagraphStyle('atelier-heading',fontName='Display',fontSize=22,leading=24,textColor=colors.HexColor(self.p['ink'])));_,h=p.wrap(CW,80);p.drawOn(c,x,y-h)
        elif kind=='atlas-facts':
            facts,x,y,w=args
            for fact in facts:
                q=Paragraph(html.escape(fact['label']).upper(),self.s['label']);_,h=q.wrap(w,80);q.drawOn(c,x,y-h);y-=h+9
                q=Paragraph(html.escape(fact['value']),self.s['body']);_,h=q.wrap(w,150);q.drawOn(c,x,y-h);y-=h+22
                c.setStrokeColor(colors.HexColor(self.p['line']));c.setLineWidth(.5);c.line(x,y+10,x+w,y+10)
        elif kind=='write-lines':
            x,y,w,h=args;c.setStrokeColor(colors.HexColor(self.p['line']));c.setLineWidth(.4)
            for dy in range(0,max(1,int(h)),19):c.line(x,y+dy,x+w,y+dy)
        elif kind=='diagram':self.draw_diagram(c,*args)
    def draw_diagram(self,c,key,d,x,y,w,h):
        def label(text,xx,yy,ww,size=12,color=None):
            q=Paragraph(html.escape(text),ParagraphStyle('diagram-label',fontName='Body',fontSize=size,leading=size*1.25,textColor=colors.HexColor(color or self.p['ink'])));_,hh=q.wrap(ww,100);q.drawOn(c,xx,yy-hh);return hh
        def box(title,lines,xx,yy,ww,hh):
            c.setFillColor(colors.HexColor(self.p['panel']));c.rect(xx,yy-hh,ww,hh,stroke=0,fill=1)
            gradient(c,xx,yy-2,ww,2,TEAL+GOLD)
            th=label(title,xx+9,yy-10,ww-18,15,self.p['gold'])
            label(' / '.join(lines),xx+9,yy-16-th,ww-18,11)
        def arrow(xx,yy,ex,ey):
            c.setStrokeColor(colors.HexColor(self.p['teal']));c.setLineWidth(.9);c.line(xx,yy,ex,ey)
            a=math.atan2(ey-yy,ex-xx);c.line(ex,ey,ex-5*math.cos(a-.5),ey-5*math.sin(a-.5));c.line(ex,ey,ex-5*math.cos(a+.5),ey-5*math.sin(a+.5))
        if key=='composition':
            # Containers point to the same owned ledger: this is a reference graph,
            # not a hierarchy asserting that every container must contain an Effect.
            bw=(w-28)/3
            for i,(title,lines) in enumerate([('Heritages',['Lineage','Upbringing','Manifest']),('Capabilities',['A readable working']),('Items',['Separate Item BU'])]):box(title,lines,x+i*(bw+14),y+h,bw,80)
            box('Effects',['Optional reusable ingredient groups'],x+w*.25,y+h-145,w*.5,70)
            box('Owned acquisition ledger',['Verb access / Domain access / Range / Output and other actual rules'],x,y+120,w,85)
            c.setStrokeColor(colors.HexColor(self.p['teal']));c.setLineWidth(1)
            for xx in [x+bw/2,x+w/2,x+w-bw/2]:c.line(xx,y+h-84,xx,y+h-113)
            c.line(x+bw/2,y+h-113,x+w-bw/2,y+h-113);arrow(x+w/2,y+h-113,x+w/2,y+h-145);arrow(x+w/2,y+h-215,x+w/2,y+120)
            label('Count each actual purchase once. A container can also use primitives directly.',x,y+22,w,11,self.p['muted'])
        elif key=='rhythm':
            names=[('Council','Review continuation. Agree intents and their dependencies.'),('Fast','Complexity 0–1. Example: secure the rope before a crossing.'),('Measured','Complexity 2–3. Resolve the connected crossing when its support exists.'),('Heavy','Complexity 4+. Resolve further dependencies, then record the changed scene.')]
            for i,(title,text) in enumerate(names):
                yy=y+h-i*69;c.setFont('Display',27);c.setFillColor(colors.HexColor(self.p['gold']));c.drawString(x,yy-30,str(i+1));box(title,[text],x+40,yy,w-40,61)
                if i<3:arrow(x+12,yy-38,x+12,yy-64)
            label('30 ft example allowance: 10 ft here + 20 ft later = 30 ft for the whole round.',x,y+42,w,11,self.p['teal'])
            label('One valid independent reaction by default; no initiative roll.',x,y+22,w,11)
        elif key=='recovery':
            stages=[('First short rest','10 / 13 Vitality','Heal 3; retain 4 of the allowance.',7,3),('Later short rest','9 / 13 Vitality','Heal 4; allowance is now 0.',4,4),('Completed long rest','Agreed overnight recovery','Refresh the allowance to 7.',7,0)]
            for i,(title,vitality,note,allowance,used) in enumerate(stages):
                yy=y+h-i*103;box(title,[vitality,note],x+92,yy,w-92,86)
                for dot in range(allowance):
                    xx=x+10+(dot%4)*18;dy=yy-22-(dot//4)*23;c.setFillColor(colors.HexColor(self.p['gold'] if dot>=used else self.p['line']));c.circle(xx,dy,6,fill=1,stroke=0)
                if i<2:arrow(x+40,yy-61,x+40,yy-95)
            label('Dots show this rest’s available allowance; muted dots are consumed.',x,y+17,w,10.5,self.p['muted'])
        elif key=='budgets':
            for i,(title,detail) in enumerate([('Creature ledger','2 creatures × 50 base BU = 100 Enemy BU'),('Equipment ledger','2 creatures × 6 Item BU = 12 Enemy Item BU'),('Combined appraisal','100 + 12 = 112 combined enemy BU'),('Execution at the table','Agree Cost for actual use. It is not purchased BU again.')]):
                yy=y+h-i*77;box(title,[detail],x,yy,w,65)
        elif key=='consequence':
            rows=[('Cause','A water curtain is held against a strong current.'),('Change','While maintained, the caster cannot leave the anchoring point.'),('Ending','Release the working, or agree another anchoring method.')]
            for i,(title,text) in enumerate(rows):
                yy=y+h-i*96;box(title,[text],x+34,yy,w-34,78)
                c.setFillColor(colors.HexColor(self.p['gold']));c.setFont('Display',24);c.drawString(x,yy-28,str(i+1))
                if i<2:arrow(x+11,yy-41,x+11,yy-89)
            label('Original example: the restriction is agreed, not a universal water rule.',x,y+25,w,11,self.p['muted'])
        else:
            nodes=d['nodes'];step=(h-26)/len(nodes)
            for i,node in enumerate(nodes):
                title,lines=node[-2:];yy=y+h-i*step;c.setFont('Display',26);c.setFillColor(colors.HexColor(self.p['gold']));c.drawString(x,yy-29,str(i+1));box(title,lines,x+41,yy,w-41,step-8)
                if i<len(nodes)-1:arrow(x+12,yy-37,x+12,yy-step+4)

def atlas_modules(book):
    file='player-field-atlas.json' if book['slug']=='players-handbook' else 'gm-field-atlas.json'
    value=json.loads((ROOT/'docs/publications/print-edition'/file).read_text())
    return value.get('modules',[]) if isinstance(value,dict) else value

def build(book,dark,out,figures,worksheets,map_class,map_definitions,proof=False):
    modules=atlas_modules(book)
    if not proof and len(modules)<24:raise ValueError('Incomplete field atlas')
    if proof:modules=modules[:3]
    blocks=book['blocks'];heads=[b for b in blocks if b['type']=='heading' and b['id']!='topic-index']
    atlas_heads=[]
    for m in modules:
        ident='field-atlas-'+m.get('id',slug(m['title']))
        atlas_heads.append({'text':m['title'],'id':ident,'level':2})
        atlas_heads.extend({'text':m['title']+' / '+s['title'],'id':ident+'-section-'+str(i+1),'level':3}for i,s in enumerate(m['sections']))
    heads+=atlas_heads
    refs={};dest=out/(book['slug']+('-dark' if dark else '')+'.pdf')
    for attempt in range(4):
        lay=Layout(book,dark,refs);lay.cover();lay.contents(heads)
        worksheet_heading=None;diagram_heading=None;table_heading=None;index_intro=[];in_index=False
        for i,b in enumerate(blocks):
            kind=b['type']
            if kind=='heading' and b['id']=='topic-index':in_index=True;continue
            if in_index:
                if kind=='paragraph':index_intro.append(b['text'])
                continue
            if kind=='heading' and i+1<len(blocks) and blocks[i+1]['type']=='worksheet':
                worksheet_heading=b;continue
            if kind=='heading' and i+1<len(blocks) and blocks[i+1]['type']=='figure':
                diagram_heading=b;continue
            if kind=='heading' and i+1<len(blocks) and blocks[i+1]['type']=='table':
                rows=blocks[i+1]['rows']
                if len(rows[0])>2 or any(len(plain(v))>130 for row in rows for v in row):table_heading=b;continue
            if kind=='heading':lay.heading(b)
            elif kind=='paragraph':lay.para(b['text'])
            elif kind=='list':
                for i,text in enumerate(b['items']):
                    style=ParagraphStyle('print-list',parent=lay.s['body'],leftIndent=10,firstLineIndent=-10)
                    lay.flow(Paragraph(('{}.'.format(i+1) if b['ordered'] else '•')+' '+inline(text,refs,dark),style),5)
            elif kind=='table':lay.table(b['rows'],table_heading);table_heading=None
            elif kind=='aside':
                for i,text in enumerate(b['paragraphs']):lay.para(text,'h3' if i==0 else 'body',8)
            elif kind=='figure':lay.figure(b['name'],figures[b['name']],diagram_heading);diagram_heading=None
            elif kind=='art':
                key=b['name'];x,top,w,bottom=lay.frames[lay.fi];a=ART[key];height=min(220,w*a['height']/a['width'])
                if any(a['page']==lay.page['number'] and a['key']==key for a in lay.placements):continue
                if lay.y-bottom<height+38:lay.advance();x,top,w,bottom=lay.frames[lay.fi]
                lay.art(key,x,lay.y-height,w,height,'inline subject');lay.y-=height+7;lay.para(a['caption'],'small',10)
            elif kind=='map':
                lay.full_page(lay.chapter,'location plan');m=map_class(b['name'],CW,dark);_,mh=m.wrap(CW,650)
                caption=map_definitions[b['name']]['caption']
                cp=Paragraph(inline(caption,refs,dark),lay.s['small']);_,ch=cp.wrap(CW,100)
                available=lay.y-BOTTOM-ch-16
                if mh>available:
                    m=map_class(b['name'],CW*available/mh,dark);_,mh=m.wrap(CW,650)
                lay.op('flow',m,lay.page['left']+(CW-m.width)/2,lay.y-mh,m.width,mh);lay.y-=mh+10
                lay.op('flow',cp,lay.page['left'],lay.y-ch,CW,ch);lay.y-=ch+6;lay.new_page()
            elif kind=='worksheet':
                lay.worksheet(b['name'],worksheets[b['name']],worksheet_heading['id'] if worksheet_heading else None);worksheet_heading=None
            elif kind=='index':continue
        lay.finish_tail();lay.atlas(modules);lay.index(heads,index_intro)
        # Empty transitions otherwise shift page refs. They are removed during
        # composition instead of changing folios after destination calculation.
        if lay.pages and not lay.pages[-1]['ops']:lay.pages.pop()
        if any(not p['ops'] for p in lay.pages):raise ValueError('Uncomposed transition pages')
        if refs==lay.marks:lay.render(dest);break
        refs=lay.marks
    else:raise ValueError('Print page references failed to converge')
    r=PdfReader(dest)
    return {'filename':dest.name,'theme':'dark' if dark else 'light','pages':len(r.pages),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'anchors':lay.marks,'links':sum(len(p.get('/Annots',[]))for p in r.pages),'words':book['words']+sum(len(section['text'].split())for m in modules for section in m['sections']),'extractedTextChars':sum(len(p.extract_text()or'')for p in r.pages),'printRevision':2,'trimInches':[7.75,10.5],'artPlacements':lay.placements,'fieldAteliers':len(modules)}
