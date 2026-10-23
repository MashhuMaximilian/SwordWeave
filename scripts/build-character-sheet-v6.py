#!/usr/bin/env python3
"""SwordWeave engraved table folios: normal/compact fronts and dense records."""
from pathlib import Path
from xml.sax.saxutils import escape
from io import BytesIO
import hashlib, json, math, re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import Color
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from pypdf import PdfReader, PdfWriter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/publications/character-sheets-v6'
TMP=ROOT/'tmp/pdfs/character-sheets-v6'
PDF=ROOT/'output/pdf'
W,H=595.276,841.89
L,R=35.,W-35.
GAP=14.;CW=(R-L-GAP)/2
for p in (OUT,TMP,PDF):p.mkdir(parents=True,exist_ok=True)
FONTS={
 'Body':ROOT/'tmp/pdfs/books/Body.ttf',
 'Bold':ROOT/'output/publications/full-phb-v6/fonts/semibold.ttf',
 'Label':ROOT/'output/publications/equation-lettering/fonts/syne-600-lining.ttf',
 'Display':ROOT/'tmp/pdfs/books/Display.ttf',
 'Head':ROOT/'output/publications/character-sheets-v2/fonts/Oxanium.ttf',
}
for name,p in FONTS.items():pdfmetrics.registerFont(TTFont(name,str(p)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
DIRECTIONS=[('01','orrery','Orrery'),('02','vesper','Vesper'),('03','aegis','Aegis'),('04','moire','Moire'),('05','serein','Serein')]
FOUNDATION=[('VERB_TIER','VERB TIERS'),('DOMAIN','DOMAINS'),('RANGE','RANGE / baseline Touch'),('INTENSITY_DICE','DICE / baseline 1d4'),('STRUCTURAL','STRUCTURES'),('DURATION','DURATION')]
FOUNDATION_CATS={k for k,_ in FOUNDATION}

def clean(t):
 return str(t).replace('\u2013','-').replace('\u2014','-').replace('\u2011','-').replace('\u00a0',' ').replace('\u2264','<=')

def source(key):
 p=ROOT/f'docs/publications/character-sheets/{key}-public-source.json'
 return json.loads(p.read_text())['character'],{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}

ORREN,OSOURCE=source('orren');ASTER,ASOURCE=source('aster')

def records(c):
 return [{'ref':f'P{i:02}','name':p['primitive']['name'],'rule':p['primitive'].get('mechanicalOutputText') or p['primitive']['narrativeRule'],
          'narrative':p['primitive']['narrativeRule'],'category':p['primitive']['category'],'source_id':p['primitive']['id'],
          'bindings':p['primitive'].get('mechanicalRule',{}).get('bindings',{}),
          'preferred':'mechanical' if p['primitive'].get('mechanicalOutputText') else 'narrative'} for i,p in enumerate(c['primitiveLinks'],1)]

def vocabulary_value(r):
 category=r['category'];name=r['name'];rule=r['rule'];bindings=r.get('bindings',{})
 if category=='VERB_TIER':return (bindings.get('tier') or name).replace('Verb Access ','').replace('Tier ','')
 if category=='DOMAIN':return str(bindings.get('domain') or name.replace('Domain of ','' )).title()
 if category=='RANGE':return name.replace(' Range','')+(' '+re.search(r'\((\d+ ft)\)',rule).group(1) if re.search(r'\((\d+ ft)\)',rule) else '')
 if category=='INTENSITY_DICE':return re.search(r'1d\d+',name+' '+rule).group(0) if re.search(r'1d\d+',name+' '+rule) else name
 if category=='STRUCTURAL':return name.replace('Structure Tier ','Tier ').replace(' Structure','')
 if category=='DURATION':return name.replace(' Duration','')
 return name

class Folio:
 def __init__(self,direction,path=None):
  self.number,self.key,self.name=direction
  self.path=path or PDF/f'swordweave-character-sheet-v6-{self.number}-{self.key}.pdf'
  self.raw=TMP/self.path.name;self.c=canvas.Canvas(str(self.raw),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Body')
  self.page=0;self.roles=[];self.texts=[];self.writing=[];self.marks=[];self.placed=[];self.art=[]
  im=Image.open(OUT/f'assets/{self.key}-frame.png').convert('RGBA')
  # Document colour separation only: preserve master and alpha; embed DeviceGray.
  self.art_image=ImageReader(Image.merge('LA',(im.convert('L'),im.getchannel('A'))));self.iw,self.ih=im.size

 def line(self,x,y,X,Y,g=.65,w=.35):
  c=self.c;c.saveState();c.setStrokeGray(g);c.setLineWidth(w);c.line(x,H-y,X,H-Y);c.restoreState()

 def poly(self,pts,g=.15,w=.55,fill=None,close=True):
  c=self.c;c.saveState();c.setStrokeGray(g);c.setLineWidth(w)
  if fill is not None:c.setFillGray(fill)
  p=c.beginPath();p.moveTo(pts[0][0],H-pts[0][1])
  for x,y in pts[1:]:p.lineTo(x,H-y)
  if close:p.close()
  c.drawPath(p,stroke=1,fill=int(fill is not None));c.restoreState()

 def ngon(self,x,y,r,n=6,fill=None,w=.5):
  self.poly([(x+r*math.cos(-math.pi/2+i*math.tau/n),y+r*math.sin(-math.pi/2+i*math.tau/n)) for i in range(n)],w=w,fill=fill)

 def curve(self,x,y,a,b,d,e,X,Y,g=.4,w=.5):
  c=self.c;c.saveState();c.setStrokeGray(g);c.setLineWidth(w);p=c.beginPath();p.moveTo(x,H-y);p.curveTo(a,H-b,d,H-e,X,H-Y);c.drawPath(p);c.restoreState()

 def text(self,t,x,y,size=8,font='Label',g=.05,align='left'):
  t=clean(t)
  if not t:return
  width=pdfmetrics.stringWidth(t,font,size);xx=x-(width/2 if align=='center' else width if align=='right' else 0)
  c=self.c;c.saveState();c.setFillGray(g);c.setFont(font,size);c.drawString(xx,H-y-size*.8,t);c.restoreState()
  self.texts.append({'page':self.page,'text':t,'box':[xx,y,xx+width,y+size],'font':font,'size':size})

 def paragraph(self,t,x,y,w,size=9.2,lead=11.1,draw=True):
  style=ParagraphStyle('p',fontName='Body',fontSize=size,leading=lead,textColor=Color(0,0,0),splitLongWords=False,allowWidows=0,allowOrphans=0)
  p=Paragraph(t,style);_,height=p.wrap(w,10000)
  if draw:
   p.drawOn(self.c,x,H-y-height);self.texts.append({'page':self.page,'text':t,'box':[x,y,x+w,y+height],'font':'Body','size':size,'paragraph':True})
  return height

 def plain(self,t,x,y,w,size=9.2,lead=11.1,draw=True):return self.paragraph(escape(clean(t)).replace('\n','<br/>'),x,y,w,size,lead,draw)

 def write(self,x,y,w,h,role):
  self.writing.append({'page':self.page,'role':role,'box':[x,y,x+w,y+h]})
  self.line(x,y+h-1,x+w,y+h-1,.57,.35)

 def frame_piece(self,src,dst):
  sx,sy,sw,sh=src;x,y,w,h=dst;c=self.c;c.saveState();clip=c.beginPath();clip.rect(x,H-y-h,w,h);c.clipPath(clip,stroke=0)
  scale_x=w/sw;scale_y=h/sh;xx=x-sx*scale_x;yy=y-sy*scale_y
  c.drawImage(self.art_image,xx,H-yy-self.ih*scale_y,width=self.iw*scale_x,height=self.ih*scale_y,mask='auto');c.restoreState()
  self.art.append({'page':self.page,'source':src,'box':dst,'source_ppi':[self.iw/(self.iw*scale_x/72),self.ih/(self.ih*scale_y/72)]})

 def begin(self,role,subtitle,character=None):
  self.page+=1;self.roles.append({'page':self.page,'role':role,'character':character})
  # Slender engraved side pieces and a complete central crown medallion. The
  # actual form uses the inner white field; no raster carries labels or rules.
  for j in range(3):
   self.frame_piece((0,330,180,1045),(7,94+j*232,22,232))
   self.frame_piece((844,330,180,1045),(W-29,94+j*232,22,232))
  # Faceted sleeves give the repeated engraved rails deliberate physical joins.
  for xx in (7,W-29):
   for yy in (94,326,558,790):
    self.poly([(xx,yy-3),(xx+4,yy-5),(xx+18,yy-5),(xx+22,yy-3),(xx+22,yy+3),(xx+18,yy+5),(xx+4,yy+5),(xx,yy+3)],g=.3,w=.4,fill=.94)
    self.line(xx+4,yy-2,xx+18,yy-2,.4,.35)
    self.line(xx+4,yy+2,xx+18,yy+2,.7,.35)
  self.frame_piece((0,0,1024,400),(L,7,125,49))
  self.frame_piece((315,1375,395,161),(W/2-38,H-41,76,30))
  self.text('S W O R D W E A V E',174,17,9.5,'Label')
  self.text(self.name.upper(),R,17,8.5,'Head',align='right')
  self.text(subtitle,174,32,6.9,'Label',g=.25)
  self.text('v0.1 ALPHA / PRINT + PENCIL',L,H-28,6.1,'Label',g=.25)
  self.text(str(self.page).zfill(2),R,H-29,7.8,'Head',align='right')
  self.c.bookmarkPage('page-'+str(self.page));self.c.addOutlineEntry(subtitle,'page-'+str(self.page),0,False)

 def end(self):self.c.showPage()

 def band(self,title,x,y,w,small=False):
  font='Head';size=8.0 if small else 9.3;tw=pdfmetrics.stringWidth(title,font,size)+20
  if self.key in ('orrery','aegis'):
   self.poly([(x,y+3),(x+6,y-1),(x+tw-5,y-1),(x+tw+2,y+5),(x+tw-5,y+11),(x+6,y+11),(x,y+7)],fill=.12)
   self.text(title,x+10,y+1,size,font,1)
   self.line(x+tw+5,y+5,x+w,y+5,.28,.65)
  elif self.key=='vesper':
   self.curve(x,y+15,x+20,y+12,x+33,y+18,x+tw,y+15)
   self.text(title,x+6,y,size,font)
   self.curve(x+tw,y+15,x+tw+15,y+12,x+w-20,y+18,x+w,y+13,g=.5)
  elif self.key=='moire':
   self.ngon(x+4,y+5,4,4,fill=.12);self.text(title,x+14,y,size,font)
   self.line(x+tw+8,y+3,x+w,y+3,.2,.5);self.line(x+tw+4,y+7,x+w-4,y+7,.58,.4)
  else:
   self.text(title,x+7,y,size,font)
   self.curve(x,y+12,x+w*.35,y+6,x+w*.65,y+6,x+w,y+12,g=.35)
  return y+18

 def name_header(self,c=None):
  # Deliberately free-form: any number or mixture of heritage organisations.
  self.text('NAME',174,48,6.2,'Label',g=.3)
  if c:self.text(c['name'],174,58,17,'Display')
  else:self.write(174,56,237,22,'name')
  self.text('LEVEL / BUDGET',R-125,49,6.6,'Label',g=.2)
  if c:self.text(f"{c['level']} / {c['buBalance']['progressionPool']} BU",R-125,62,11,'Head')
  else:self.write(R-125,61,125,17,'level_budget')
  self.text('CONCEPT / HERITAGES',L,87,6.3,'Label',g=.25)
  if c:
   label=' / '.join([c.get('lineageName') or '',c.get('upbringingName') or '',c.get('manifestName') or '']).strip(' /')
   self.text(label,L+104,85,8.7,'Body')
  else:self.write(L+104,84,R-L-104,14,'concept_heritages')

 def vital_strip(self,c=None,dense=False):
  y=105;self.line(L,y,R,y,.2,.7)
  widths=[154,54,45,119,139.276];labels=['VITALITY','DC','PB','SHORT REST','MOVEMENT / ft']
  xx=L;sh=44 if dense else 53;value_y=22 if dense else 29
  for w,label in zip(widths,labels):
   self.text(label,xx+5,y+5,6.7,'Head')
   if label=='VITALITY':
    self.text('MAX',xx+5,y+14 if dense else y+20,5.8);self.text('CURRENT',xx+68,y+14 if dense else y+20,5.8)
    if c:self.text(str(c['vitality']['max']),xx+5,y+value_y,14,'Label')
    else:self.write(xx+5,y+value_y,50,18,'max_vitality')
    self.write(xx+68,y+value_y,w-74,18,'current_vitality')
   elif label in ('DC','PB'):
    if c:self.text('18' if label=='DC' else '+5',xx+w/2,y+25,14,'Head',align='center')
    else:self.write(xx+6,y+value_y,w-12,18,label.lower())
   elif label=='SHORT REST':
    self.text('CAP',xx+6,y+14 if dense else y+20,5.8);self.text('LEFT',xx+58,y+14 if dense else y+20,5.8)
    if c:self.text(str((c['vitality']['max']+1)//2),xx+6,y+value_y,12,'Label')
    else:self.write(xx+6,y+value_y,42,18,'recovery_cap')
    self.write(xx+58,y+value_y,w-65,18,'recovery_remaining')
   else:
    if c:
     speed='Walk 30 / climb 15 / swim 15'
     if c['name']==ASTER['name']:speed+=' / fly 30'
     self.plain(speed,xx+5,y+19,w-10,7.4,8.6)
    else:self.text('Walk ___ Climb ___ Swim ___',xx+5,y+20,6.8,'Body')
    self.text('USED / ROUND',xx+5,y+35 if dense else y+37,5.7);self.write(xx+67,y+29 if dense else y+32,w-73,12 if dense else 17,'movement_used')
   xx+=w
   if xx<R-1:self.line(xx,y+4,xx,y+sh-4,.55,.4)
  self.line(L,y+sh,R,y+sh,.3,.5)

 def practice_mark(self,x,y,practice,training=0):
  self.ngon(x,y,2.7,6,fill=.13 if training==2 else None,w=.45)
  if training==1:
   self.c.saveState();self.c.setFillGray(0);self.c.circle(x,H-y,.85,stroke=0,fill=1);self.c.restoreState()
  self.marks.append({'page':self.page,'practice':practice,'training':training,'box':[x-3,y-3,x+3,y+3]})

 def attribute_row(self,c=None,dense=False):
  y=155 if dense else 167;gap=12;w=(R-L-2*gap)/3;ah=62 if dense else 85
  groups=[('Physical',['prowess','finesse','fieldcraft']),('Mental',['awareness','reason','knowledge','influence']),('Magical',['mysticism','communion','intuition'])]
  for index,(name,practices) in enumerate(groups):
   x=L+index*(w+gap);cy=y+18
   if self.key=='aegis':
    self.poly([(x,y+3),(x+w-7,y+3),(x+w,y+10),(x+w,y+ah),(x+7,y+ah),(x,y+ah-7)],fill=1)
    self.poly([(x,y+3),(x+4,y+3),(x+2,y+ah-7),(x,y+ah-10)],fill=.22)
   elif self.key in ('vesper','serein'):
    self.curve(x,y+ah,x-6,y+ah*.6,x-6,y+8,x+12,y+3,g=.7,w=.45)
    self.curve(x+w-12,y+3,x+w+6,y+8,x+w+6,y+ah*.6,x+w,y+ah,g=.7,w=.45)
   else:
    self.line(x,y+ah,x+w,y+ah,.45,.5)
    self.line(x+17,y+6,x+w,y+6,.4,.5)
   radius=14 if self.key!='moire' else 15
   self.ngon(x+18,cy,radius,8 if self.key in ('aegis','serein') else 6,fill=.96,w=.7)
   self.ngon(x+18,cy,radius-2,8 if self.key in ('aegis','serein') else 6,w=.25)
   # The header is an engraved instrument, with open practices below it.
   if self.key=='orrery':
    self.c.saveState();self.c.setStrokeGray(.32);self.c.setLineWidth(.35);self.c.circle(x+18,H-cy,radius+3,stroke=1,fill=0);self.c.restoreState()
    for a in range(0,360,30):
     angle=math.radians(a);self.line(x+18+(radius+3)*math.cos(angle),cy+(radius+3)*math.sin(angle),x+18+(radius+5)*math.cos(angle),cy+(radius+5)*math.sin(angle),.4,.35)
   elif self.key=='moire':
    self.ngon(x+18,cy,radius+4,4,w=.5)
   tabx=x+37;tabw=w-39
   if self.key in ('orrery','aegis','moire'):
    self.poly([(tabx,y+6),(tabx+tabw-5,y+6),(tabx+tabw,y+12),(tabx+tabw-5,y+18),(tabx,y+18)],fill=.12,w=.3)
   elif self.key=='vesper':
    self.curve(x+35,y+4,x+w*.60,y-3,x+w*.70,y+4,x+w,y+1,g=.2,w=.8)
   else:
    self.poly([(x+35,y+4),(x+w/2,y-3),(x+w,y+4)],w=.55,close=False)
   if c:self.text(str(c['conditionContext']['character']['attributes'][name.lower()]),x+18,cy-6,13,'Head',align='center')
   else:self.write(x+11,cy-7,14,15,'attribute_'+name.lower())
   self.text(name.upper(),x+41,y+8,8.5,'Head',1 if self.key in ('orrery','aegis','moire') else .05)
   self.text('SAVE',x+38,y+23,5.8)
   if c:
    save={'Physical':13 if c['name']==ORREN['name'] else 4,'Mental':2 if c['name']==ORREN['name'] else 3,'Magical':3 if c['name']==ORREN['name'] else 18}[name]
    self.text(f'+{save}',x+69,y+20,8.8,'Label')
   else:self.write(x+70,y+19,w-74,13,'save_'+name.lower())
   rows={p['practice']:p for p in c['practices']} if c else {}
   for j,p in enumerate(practices):
    yy=y+36+(j//2)*11.5 if dense else y+40+j*10.6
    px=x+(j%2)*(w/2) if dense else x;pw=w/2 if dense else w
    row=rows.get(p);training=0 if not row else min(2,row.get('pbContribution',0)//5)
    self.practice_mark(px+9,yy+3.5,p,training)
    self.text(p.title(),px+16,yy,7.8 if dense else 8.4,'Body')
    if row:self.text(f"+{row['total']}",px+pw-4,yy,7.8 if dense else 8.8,'Label',align='right')
    else:self.write(px+pw-22 if dense else px+pw-34,yy-1,18 if dense else 29,10,'practice_'+p)
  self.text('Practice hex: empty = untrained / dot = proficient / filled = expertise',L,220 if dense else 258,6.3,'Body',g=.22)

 def foundation(self,c=None,dense=False,source_rows=None):
  # Group these acquisitions once, in a dedicated strip; other rules flow below.
  base=233 if dense else 276
  self.band('COMPOSITION VOCABULARY',L,base,R-L,True)
  rows=source_rows if source_rows is not None else records(c) if c else [];w=(R-L-2*9)/3
  for i,(category,label) in enumerate(FOUNDATION):
   col=i%3;row=i//3;x=L+col*(w+9);y=base+19+row*29
   self.text(label,x,y,6.3,'Head')
   selected=[r for r in rows if r['category']==category]
   if c or source_rows is not None:
    text=' / '.join(r['ref']+' '+vocabulary_value(r) for r in selected)
    if not text and category=='RANGE':text='Touch baseline (no purchase)'
    if not text and category=='INTENSITY_DICE':text='1d4 baseline (no purchase)'
    self.plain(text or 'None recorded',x,y+10,w,8.4,9.4)
    for r in selected:self.placed.append({'page':self.page,**r,'display_value':vocabulary_value(r),'area':'foundation'})
   else:
    self.write(x,y+9,w,19,'vocabulary_'+category)

 def blank_rule_rows(self,y,bottom,count):
  per=(count+1)//2;h=(bottom-y)/per
  for col in range(2):
   x=L+col*(CW+GAP)
   for j in range(min(per,count-col*per)):
    yy=y+j*h
    if j%2==0:
     self.c.saveState();self.c.setFillGray(.975);self.c.rect(x,H-yy-h,CW,h,fill=1,stroke=0);self.c.restoreState()
    self.text(str(col*per+j+1).zfill(2),x+2,yy+3,5.7,'Head',g=.4)
    if count>30:
     self.write(x+17,yy+2,CW-21,h-4,'primitive_name_and_rule')
    else:
     self.text('NAME / REF',x+18,yy+3,5.7,'Label',g=.38)
     self.write(x+75,yy+1,CW-79,13,'primitive_name')
     self.write(x+18,yy+15,CW-22,h-18,'primitive_mechanical_rule')
    self.line(x,yy+h,x+CW,yy+h,.67,.3)

 def flow_rules(self,rows,y=365,bottom=745,size=9.1,lead=10.8):
  col=0;yy=y
  for r in rows:
   html=f'<b>{escape(r["ref"]+" / "+clean(r["name"]))}</b> · {escape(clean(r["rule"]))}'
   height=self.paragraph(html,L,yy,CW-6,size,lead,False)+2
   if yy+height>bottom and col==0:col=1;yy=y
   if yy+height>bottom:return rows[rows.index(r):]
   x=L+col*(CW+GAP);self.paragraph(html,x+3,yy,CW-6,size,lead)
   self.line(x,yy+height-1,x+CW,yy+height-1,.72,.3)
   self.placed.append({'page':self.page,**r,'area':'primitive_rules'});yy+=height
  return []

 def front(self,density='normal',c=None,stress=None):
  self.begin('front / '+density,('NORMAL / OPEN HANDWRITING' if density=='normal' else 'COMPACT / DENSE VOCABULARY')+(' / EXAMPLE' if c else ' / LAYOUT TEST' if stress else ''),c['name'] if c else None)
  dense=density=='compact';self.name_header(c);self.vital_strip(c,dense);self.attribute_row(c,dense);self.foundation(c,dense,stress)
  base=311 if dense else 355;start=base+29
  self.band('PRIMITIVES / REUSABLE EFFECTS',L,base,R-L)
  self.text('Name + mechanical rule; use narrative text when no mechanical text exists.',L,base+17,6.4,'Body',g=.28)
  remaining=[]
  if c:remaining=self.flow_rules([r for r in records(c) if r['category'] not in FOUNDATION_CATS],start,744,9.1,10.8)
  elif stress:remaining=self.flow_rules([r for r in stress if r['category'] not in FOUNDATION_CATS],start,744,8.7,10.3)
  else:self.blank_rule_rows(start+2,744,20 if density=='normal' else 50)
  self.line(L,749,R,749,.25,.65)
  self.text('ONGOING / DEFENCES / DRAWBACKS / HOW THEY END',L,754,6.4,'Head')
  if c and c['name']==ASTER['name']:
   self.plain('Flight: constant forward motion; no hover. Glide: 30 ft sideways per 10 ft down. Survey sight: Fieldcraft +5 only for its named measurement; no shot bonus.',L,765,R-L,7.8,9)
  else:self.write(L,764,R-L,17,'ongoing_endings')
  self.text('REACTION',L,789,5.8);self.ngon(L+55,792,3,4)
  self.text('SLOTS used / max',L+75,789,5.8);self.write(L+159,785,25 if c else 51,13,'slots_current')
  if c:self.text('/ '+str(c['encumbrance']['equipSlotsAvailable']),L+190,788,8.2,'Body')
  self.text('LOAD / capacity',L+227,789,5.8);self.write(L+309,785,31 if c else 69,13,'load_current')
  if c:self.text('/ '+str(c['carryCapacity']),L+344,788,8.2,'Body')
  self.text('FULL RULES / folio',L+397,789,5.8);self.write(R-40,785,40,13,'rule_folio')
  self.end()
  while remaining:
   self.begin('primitive continuation','PRIMITIVES / CONTINUED',c['name'] if c else 'LAYOUT STRESS TEST')
   self.band('PRIMITIVES / EXACT RULES',L,70,R-L);self.text('Character / sheet reference',L,95,7,'Body');self.write(L+130,91,R-L-130,16,'character_reference')
   before=len(remaining);remaining=self.flow_rules(remaining,124,788,9.1,10.8);assert len(remaining)<before
   self.end()

 def blank_catalogue(self):
  self.begin('blank catalogue','CAPABILITIES / EQUIPMENT / IDENTITY')
  self.text('CHARACTER',L,69,6.5);self.write(L+65,65,190,18,'character')
  for label,x in [('CHARACTER BU spent / left',L+272),('ITEM BU',R-61)]:
   self.text(label,x,66,6.0);self.write(x,76,104 if x<R-100 else 61,17,'budget_account')
  self.band('CAPABILITIES / REMEMBERED COMPOSITIONS',L,108,R-L)
  self.text('Ref / name / ingredients / exact outcome / Cost, limits and ending',L,126,6.4,'Body',g=.3)
  h=31
  for col in range(2):
   x=L+col*(CW+GAP)
   for i in range(10):
    y=142+i*h;self.text(str(col*10+i+1).zfill(2),x+2,y+2,6,'Head',g=.3);self.write(x+18,y,CW-18,h-3,'capability_record')
  self.band('EQUIPMENT / CARRIED ITEMS',L,467,R-L)
  headers=[('EQ',0),('ITEM / REF / NOTES',20),('QTY',293),('LOAD',329),('SLOTS',371),('ITEM BU',418),('STATE',471)]
  for label,dx in headers:self.text(label,L+dx,488,6.1,'Head')
  self.line(L,500,R,500,.25,.6)
  for i in range(16):
   y=503+i*13;self.ngon(L+5,y+4,2.4,4);self.line(L,y+11,R,y+11,.7,.3)
   for dx in [18,284,323,365,410,464]:self.line(L+dx,y-3,L+dx,y+11,.76,.25)
   self.writing.append({'page':self.page,'role':'item_name','box':[L+22,y,L+279,y+10]})
  self.text('TOTAL / equipped slots used / max ______ / ______    Load / capacity ______ / ______    separate Item BU ______',L,718,7,'Body')
  self.band('CONCEPT / HERITAGES / TIES / HISTORY',L,741,R-L,True)
  self.write(L,761,R-L,17,'identity_notes')
  self.text('Agreed bonus ______   Mirror credit / debt ______ / ______   Advancement / agreement ___________________',L,785,7,'Body')
  self.end()

 def blank_continuation(self):
  self.begin('blank continuation','RULES / CONTINUATION FOLIO')
  self.text('CHARACTER',L,69,6.5);self.write(L+66,65,205,18,'character')
  self.text('FOLIO / FROM',L+295,69,6.5);self.write(L+379,65,R-L-379,18,'folio_reference')
  self.band('PRIMITIVES / EFFECTS / CAPABILITIES / ITEM RULES',L,106,R-L)
  self.text('Ref + name + mechanical rule, or narrative rule if absent. Wrap across as many lines as needed.',L,126,7.2,'Body')
  for col in range(2):
   x=L+col*(CW+GAP)
   self.text('REF',x+1,147,6.2,'Head');self.text('NAME / ACTUAL RULE / LIMITS / ENDING',x+25,147,6.2,'Head')
   self.line(x+20,160,x+20,786,.65,.3)
   for y in range(160,787,12):self.line(x,y,x+CW,y,.68,.3)
   self.writing.append({'page':self.page,'role':'flowing_rule_continuation','box':[x+24,160,x+CW,786]})
  self.text('Repeat this folio when needed. References reuse owned ingredients; they do not purchase them again.',L,795,6.7,'Body',g=.25)
  self.end()

 def workbench(self):
  self.begin('blank workbench','AT THE TABLE / COMPOSE / ACQUIRE')
  self.text('CHARACTER',L,69,6.5);self.write(L+66,65,205,18,'character')
  self.text('SESSION / DATE',L+292,69,6.5);self.write(L+383,65,R-L-383,18,'session')
  self.band('AD-HOC COMPOSITIONS',L,102,R-L)
  self.text('Reusing an owned ingredient is a reference, not another acquisition.',L,121,7.2,'Body')
  for col in range(2):
   for row in range(3):
    x=L+col*(CW+GAP);y=143+row*126
    self.ngon(x+5,y+7,4,6);self.text('INTENT / NAME',x+17,y+2,6.6,'Head');self.write(x+106,y,CW-110,15,'composition_name')
    self.text('Ingredients / refs',x+2,y+23,6.4,'Body');self.write(x+93,y+19,CW-97,15,'ingredient_refs')
    self.text('Target / reach / output / resolution',x+2,y+41,6.4,'Body');self.write(x+2,y+50,CW-6,14,'scope_resolution')
    self.text('Agreed complexity / execution Cost',x+2,y+70,6.4,'Body');self.write(x+2,y+79,CW-6,14,'complexity_cost')
    self.text('Upkeep / limits / ending',x+2,y+99,6.4,'Body');self.write(x+126,y+95,CW-130,16,'upkeep_ending')
    self.line(x,y+119,x+CW,y+119,.3,.5)
  self.band('NEW PRIMITIVES / PURCHASED DURING PLAY',L,536,R-L)
  self.text('Ref / name + actual rule                                      BU / source / agreement / update main record',L,557,7,'Body')
  for i in range(7):
   y=575+i*25;self.text('+',L+2,y+4,9,'Head');self.write(L+18,y,R-L-22,22,'midgame_primitive')
  self.text('BU before ______   spent ______   available ______     Approved by / notes _______________________________',L,762,7.5,'Body')
  self.text('Record actual temporary changes and their ending; update the play sheet after the scene.',L,782,7.2,'Body',g=.25)
  self.end()

 def reference_records(self,c):
  result=[];nodes=c['readOnlyGraph']['nodes']
  for r in records(c):
   # Mechanical text is on the front; the appendix preserves the unabridged
   # authored narrative once, without printing near-identical rules twice.
   result.append((r['ref']+' / '+r['name'],r['narrative']))
  for i,n in enumerate(n for n in nodes if n['kind']=='effect'):
   result.append((f'E{i+1:02} / '+n['name'],n.get('description') or n.get('data',{}).get('narrativeDescription') or ''))
  seen=set();caps=[]
  for link in c['capabilityLinks']:
   cap=link['capability'];caps.append(cap);seen.add(cap['id'])
  for i,link in enumerate(c['itemLinks'],1):
   item=link['item'];body=item.get('description') or item.get('verboseDescription') or item.get('narrativeDescription') or ''
   itemload={'TINY':1,'SMALL':1,'MEDIUM':2,'LARGE':4,'HUGE':8,'GARGANTUAN':16}[item['size']]*link['quantity']
   body=f"Qty {link['quantity']}; Load {itemload}; equipped slots {item['slotCost'] if link['equipped'] else 0}; Item BU {item['buCost']}; {'equipped' if link['equipped'] else 'carried'}.\n"+body
   for p in item.get('primitiveLinks',[]):body+='\n'+p['primitive']['name']+': '+p['primitive']['narrativeRule']
   if c['name']==ORREN['name'] and i==1:
    for pid in ('23219','23347'):
     n=next(n for n in nodes if n['kind']=='primitive' and str(n['id'])==pid);body+='\n'+n['name']+': '+n['description']
   for p in item.get('capabilityLinks',[]):
    cap=p['capability']
    if cap['id'] not in seen:caps.append(cap);seen.add(cap['id'])
   result.append((f'I{i:02} / '+item['name'],body))
  for i,cap in enumerate(caps,1):result.append((f'C{i:02} / '+cap['name'],cap.get('verboseDescription') or cap.get('narrativeDescription') or ''))
  for link in c['heritageLinks']:
   h=link['heritage'];result.append(('Heritage / '+h['name'],h['description']))
  for title,body in c.get('backstory',{}).items():result.append((title.title(),str(body)))
  result.append(('Build account',f"Level {c['level']}; Character BU {c['buBalance']['progressionSpent']}/{c['buBalance']['progressionPool']}; {c['buBalance']['progressionRemaining']} available; separate Item BU {c['buBalance']['itemBuSpent']}. No mirrored acquisition recorded; the personal flaw grants no invented credit."))
  return result

 def filled_reference(self,c):
  pending=self.reference_records(c);index=0
  while index<len(pending):
   self.begin('full source reference','RULES / EFFECTS / CAPABILITIES / ITEMS',c['name'])
   self.text(c['name'],L,70,16,'Display');self.text('Original rules and limits / references match the front',L,94,7.5,'Body')
   page_before=index
   for col in range(2):
    y=117;x=L+col*(CW+GAP)
    while index<len(pending):
     name,body=pending[index];html=f'<b>{escape(clean(name))}</b><br/>{escape(clean(body)).replace(chr(10),"<br/>")}'
     ht=self.paragraph(html,x,y,CW,9.0,10.6,False)+4
     if y+ht>791:break
     self.paragraph(html,x,y,CW,9.0,10.6);self.line(x,y+ht-2,x+CW,y+ht-2,.74,.3);y+=ht;index+=1
   assert index>page_before,'A source paragraph exceeds one full reading column; split it explicitly before export.'
   self.end()

 def save(self):
  self.c.save();r=PdfReader(self.raw);w=PdfWriter();w.clone_document_from_reader(r)
  for name in ('aubrey','syne','unicaone'):p=ROOT/f'docs/publications/quick-core/font-notices/{name}-OFL.txt';w.add_attachment(p.name,p.read_bytes())
  p=ROOT/'docs/publications/character-sheets-v2/oxanium-OFL.txt';w.add_attachment(p.name,p.read_bytes())
  w.add_metadata({'/Title':f'SwordWeave / {self.name} / normal + compact','/Author':'SwordWeave','/Subject':'Engraved monochrome character folio; local review only'})
  with self.path.open('wb') as f:w.write(f)
  data={'key':self.key,'name':self.name,'path':str(self.path),'pages':len(r.pages),'sha256':hashlib.sha256(self.path.read_bytes()).hexdigest(),
        'roles':self.roles,'text_boxes':self.texts,'writing_fields':self.writing,'practice_marks':self.marks,'rule_placements':self.placed,'art_placements':self.art}
  print(self.path.name,len(r.pages),'pages',flush=True);return data

def main():
 result=[]
 for d in DIRECTIONS:
  f=Folio(d);f.front('normal');f.front('compact');f.blank_catalogue();f.workbench();f.blank_continuation()
  if d[1] in ('orrery','vesper'):
   c=ORREN if d[1]=='orrery' else ASTER;f.front('compact',c);f.filled_reference(c)
  result.append(f.save())
 (OUT/'manifest.json').write_text(json.dumps({'source_snapshots':[OSOURCE,ASOURCE],'designs':result,'art_manifest':str(ROOT/'docs/publications/character-sheets-v6/art-manifest.json')},indent=2)+'\n')
 # Capacity evidence uses original source text, not invented permissions or a
 # claimed legal 80-primitive character. Repetition stresses pagination only.
 pool=records(ORREN)+records(ASTER)
 stress=[]
 for i in range(80):
  r=dict(pool[i%len(pool)]);r['ref']=f'S{i+1:02}';stress.append(r)
 p=OUT/'density-proof.pdf';f=Folio(DIRECTIONS[0],p)
 f.front('compact',stress=stress[:49]);split=f.page
 f.front('compact',stress=stress);e=f.save()
 (OUT/'density-proof.json').write_text(json.dumps({'purpose':'Pagination only; copied original source records, not a valid build','49_records_pages':split,'80_records_pages':f.page-split,'all_records':e['rule_placements'],'pdf':str(p),'sha256':e['sha256']},indent=2)+'\n')

if __name__=='__main__':main()
