#!/usr/bin/env python3
"""Twelve complete monochrome SwordWeave folios, with distinct native interiors."""
from pathlib import Path
from xml.sax.saxutils import escape
import importlib.util,json,hashlib,math,re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader,PdfWriter
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('v9',ROOT/'scripts/build-character-sheet-v9.py')
v9=importlib.util.module_from_spec(spec);spec.loader.exec_module(v9)
v8=v9.v8;v7=v9.v7;v6=v7.v6
W,H,L,R,GAP,CW=v9.W,v9.H,v9.L,v9.R,v9.GAP,v9.CW
OUT=ROOT/'output/publications/character-sheets-v10';TMP=ROOT/'tmp/pdfs/character-sheets-v10';PDF=ROOT/'output/pdf/character-sheets-collection'
for p in (OUT,TMP,PDF):p.mkdir(parents=True,exist_ok=True)
STYLES=[
 ('aegis','Aegis','left','Architectural crystal armour / chamfered plates / stepped ribs'),
 ('vesper','Vesper','stack','Silver botanical filigree / pointed leaf seals / flowing stems'),
 ('orrery','Orrery','right','Astronomical instruments / orbital dials / graduated scales'),
 ('moire','Moire','left','Interlaced silver ribbons / woven diamonds / double-strand grids'),
 ('serein','Serein','right','Lunar cathedral / crescent sockets / slender vaulted tracery'),
 ('prism','Prism','left','Refracting quartz / lozenge gauges / split crystal facets'),
 ('cipher','Cipher','left','Arcane circuitry / hexagonal logic / broken bus-line brackets'),
 ('helix','Helix','stack','Living biotechnology / cellular seeds / branching rib networks'),
 ('cinder','Cinder','left','Forged workshop / riveted gear housings / indexed plate tables'),
 ('nocturne','Nocturne','right','Eclipse and moth wing / almond seals / curved vein tracery'),
 ('tidal','Tidal','stack','Oceanographic instruments / ripple seals / flowing current rails'),
 ('solstice','Solstice','left','Solar Art Deco / radiant fan gauges / stepped chevrons'),
]
ORGANIC={'vesper','helix','nocturne','tidal','serein'}

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
class Folio(v9.Aegis):
 def __init__(self,index,style,path=None):
  key,name,arch,brief=style
  super().__init__(path or PDF/f'swordweave-character-sheet-{index:02}-{key}.pdf')
  self.key,self.name,self.arch,self.brief=key,name,arch,brief;self.number=str(index).zfill(2)
  self.master=(ROOT/'output/publications/character-sheets-v6/assets' if index<=5 else OUT/'assets')/(key+'-frame.png')
  im=Image.open(self.master).convert('RGBA');self.iw,self.ih=im.size
  self.art_image=ImageReader(Image.merge('LA',(im.convert('L'),im.getchannel('A'))))
  self.raw=TMP/self.path.name
  self.c=canvas.Canvas(str(self.raw),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Body')
  self.furniture=[];self.panels=[];self.tables=[]

 def circle(self,x,y,r,g=.4,width=.4,fill=None):
  c=self.c;c.saveState();c.setStrokeGray(g);c.setLineWidth(width)
  if fill is not None:c.setFillGray(fill)
  c.circle(x,H-y,r,stroke=1,fill=int(fill is not None));c.restoreState()

 def roundbox(self,x,y,w,h,r,fill=1,g=.4,width=.5):
  c=self.c;c.saveState();c.setStrokeGray(g);c.setFillGray(fill);c.setLineWidth(width)
  c.roundRect(x,H-y-h,w,h,r,stroke=1,fill=1);c.restoreState()

 def motif(self,x,y,r=4):
  k=self.key
  if k in ('orrery','tidal','serein','nocturne'):
   self.circle(x,y,r,.35,.45)
   if k=='orrery':
    self.c.saveState();self.c.setStrokeGray(.55);self.c.setLineWidth(.3);self.c.ellipse(x-r-2,H-y-r/2,x+r+2,H-y+r/2,stroke=1,fill=0);self.c.restoreState()
   elif k=='tidal':self.curve(x-r,y,x-r/2,y-r/2,x+r/2,y+r/2,x+r,y,g=.4,w=.35)
   else:self.curve(x+1,y-r+1,x-r+2,y-r/2,x-r+2,y+r/2,x+1,y+r-1,g=.3,w=.5)
  elif k in ('vesper','helix'):
   self.bezier_shape((x,y-r),[(x+r*1.3,y-r/3,x+r*1.1,y+r/2,x,y+r),(x-r*1.2,y+r/2,x-r,y-r/2,x,y-r)],fill=.93,g=.4,width=.4)
   self.line(x,y-r+1,x,y+r-1,.5,.3)
  elif k=='cinder':
   pts=[(x+(r if i%2 else r*.78)*math.cos(i*math.tau/24),y+(r if i%2 else r*.78)*math.sin(i*math.tau/24)) for i in range(24)]
   self.poly(pts,fill=.93,w=.4);self.circle(x,y,r*.45,.5,.3)
  elif k=='solstice':
   for i in range(12):
    a=i*math.tau/12;self.line(x+math.cos(a)*r*.6,y+math.sin(a)*r*.6,x+math.cos(a)*r,y+math.sin(a)*r,.5,.3)
   self.circle(x,y,r*.5,.35,.4,1)
  else:
   self.ngon(x,y,r,6 if k=='cipher' else 4,fill=.94,w=.4)
   if k in ('moire','prism'):self.line(x,y-r,x,y+r,.55,.3)

 def full_frame(self):
  if self.key=='aegis':return super().full_frame()
  cut={'vesper':12,'orrery':8,'moire':16,'serein':20,'prism':23,'cipher':7,'helix':14,'cinder':6,'nocturne':18,'tidal':10,'solstice':15}[self.key]
  pts=[(14,14+cut),(14+cut,14),(W-14-cut,14),(W-14,14+cut),(W-14,H-14-cut),(W-14-cut,H-14),(14+cut,H-14),(14,H-14-cut)]
  self.poly(pts,g=.42,w=.7);self.frame_paths.append({'page':self.page,'kind':'closed_outer_body','points':pts})
  for x in (18,W-27):
   if self.key in ORGANIC:
    self.curve(x+4,45,x-2,190,x+11,610,x+4,H-42,g=.55,w=.65)
    self.curve(x+7,44,x+12,260,x-1,570,x+7,H-42,g=.65,w=.35)
   else:
    self.poly([(x,45),(x+9,45),(x+9,H-45),(x,H-45)],fill=.96,g=.45,w=.45)
    for yy in range(102,774,56):
     if self.key=='cipher':self.poly([(x+1,yy),(x+6,yy),(x+6,yy+9),(x+9,yy+9)],g=.5,w=.35,close=False)
     elif self.key=='solstice':self.poly([(x+1,yy),(x+4,yy+4),(x+8,yy)],g=.5,w=.35,close=False)
     else:self.line(x+2,yy,x+7,yy+4,.65,.3)
  # Continuous native shoulders and sill join the 300+ PPI engraved rails.
  for side in (-1,1):
   tr=lambda x:x if side==-1 else W-x
   if self.key in ORGANIC:
    for d in (0,3):self.curve(tr(25),34+d,tr(100),37+d,tr(190),23+d,tr(W/2),28+d,g=.45+d*.05,w=.45)
   else:
    self.poly([(tr(25),32),(tr(83),32),(tr(102),40),(tr(163),40),(tr(184),29),(tr(W/2),29)],g=.45,w=.55,close=False)
    self.poly([(tr(25),36),(tr(82),36),(tr(101),44),(tr(164),44),(tr(185),33),(tr(W/2),33)],g=.7,w=.3,close=False)
  self.line(25,H-29,W-25,H-29,.5,.6);self.line(25,H-24,W-25,H-24,.65,.35)
  self.frame_piece((0,0,220,350),(14,14,47,74.77));self.frame_piece((804,0,220,350),(W-61,14,47,74.77))
  self.frame_piece((0,0,1024,400),(W/2-80,14,160,62.5))
  for j in range(3):
   for src,x in [((0,330,180,1045),14),((844,330,180,1045),W-33)]:self.frame_piece(src,(x,79+j*235,19,235))
  for x in (14,W-33):
   for yy in (79,314,549,784):
    if self.key in ORGANIC:
     self.curve(x,yy-2,x+5,yy-6,x+14,yy-6,x+19,yy-2,g=.45,w=.5)
     self.curve(x,yy+2,x+5,yy+6,x+14,yy+6,x+19,yy+2,g=.55,w=.35)
    else:self.poly([(x,yy-3),(x+4,yy-5),(x+15,yy-5),(x+19,yy-1),(x+19,yy+3),(x+4,yy+5),(x,yy+1)],fill=.96,g=.45,w=.4)
  self.frame_piece((0,1300,180,236),(14,H-59,19,32.78));self.frame_piece((844,1300,180,236),(W-33,H-59,19,32.78))
  self.frame_piece((315,1375,395,161),(W/2-22,H-33,44,17.94))

 def begin(self,role,subtitle,character=None):
  if self.key=='aegis':return super().begin(role,subtitle,character)
  self.page+=1;self.roles.append({'page':self.page,'role':role,'character':character});self.full_frame()
  self.text('S W O R D W E A V E',L+30,78,8.9,'Label');self.text(self.name.upper(),R-30,78,8.2,'Head',align='right')
  subtitle=subtitle.replace('NORMAL / CHARACTER INSTRUMENT','NORMAL / CHARACTER FRONT').replace('COMPACT / CHARACTER INSTRUMENT','COMPACT / CHARACTER FRONT')
  self.text(subtitle,R-30,91,6.8,'Head',align='right')
  self.rect(L+6,H-26,101,11,1);self.rect(R-25,H-26,25,11,1)
  self.text('v0.1 ALPHA / PRINT + PENCIL',L+9,H-23,5.8,'Label',g=.25);self.text(str(self.page).zfill(2),R-7,H-23,6.8,'Head',align='right')
  self.c.bookmarkPage('page-'+str(self.page));self.c.addOutlineEntry(subtitle,'page-'+str(self.page),0,False)

 def molding(self,x,y,w,h,fill=.975):
  if self.key=='aegis':return super().molding(x,y,w,h,fill)
  self.panels.append({'page':self.page,'style':self.key,'box':[x,y,x+w,y+h]})
  k=self.key
  if k in ('vesper','helix','tidal','nocturne','serein'):
   r=7 if k in ('helix','tidal') else 11
   self.roundbox(x,y,w,h,r,fill,.4,.55)
   if k=='vesper':
    self.curve(x+4,y+14,x+2,y+5,x+9,y+3,x+21,y+4,g=.55,w=.35)
    self.curve(x+w-4,y+h-14,x+w-2,y+h-5,x+w-9,y+h-3,x+w-21,y+h-4,g=.55,w=.35)
   elif k=='helix':
    for xx,s in ((x+3,1),(x+w-3,-1)):
     self.curve(xx,y+15,xx+s*3,y+18,xx+s*3,y+h-18,xx,y+h-15,g=.68,w=.35)
   elif k=='tidal':
    for dd in (3,5):self.curve(x+12,y+h-dd,x+w*.35,y+h-dd-2,x+w*.65,y+h-dd+1,x+w-12,y+h-dd,g=.7,w=.25)
   elif k=='nocturne':
    self.curve(x+6,y+12,x+w*.15,y+2,x+w*.2,y+3,x+w*.3,y+3,g=.55,w=.3)
    self.curve(x+w-6,y+h-12,x+w*.85,y+h-2,x+w*.8,y+h-3,x+w*.7,y+h-3,g=.55,w=.3)
   else:
    self.curve(x+4,y+17,x+3,y+6,x+6,y+3,x+17,y+3,g=.5,w=.4)
    self.curve(x+w-4,y+17,x+w-3,y+6,x+w-6,y+3,x+w-17,y+3,g=.5,w=.4)
  else:
   cut={'orrery':5,'moire':8,'prism':9,'cipher':4,'cinder':6,'solstice':8}[k]
   pts=[(x+cut,y),(x+w-cut,y),(x+w,y+cut),(x+w,y+h-cut),(x+w-cut,y+h),(x+cut,y+h),(x,y+h-cut),(x,y+cut)]
   self.poly(pts,fill=fill,g=.38,w=.55)
   if k=='orrery':
    for xx in (x+7,x+w-7):
     for dy in (4,7,10):self.line(xx-1,y+dy,xx+1,y+dy,.65,.25)
   elif k=='moire':
    self.line(x+3,y+12,x+3,y+h-12,.6,.3);self.line(x+w-3,y+12,x+w-3,y+h-12,.6,.3)
    for xx,yy in ((x+6,y+6),(x+w-6,y+h-6)):self.poly([(xx-3,yy),(xx,yy-3),(xx+3,yy),(xx,yy+3)],g=.6,w=.3)
   elif k=='prism':
    self.poly([(x+4,y+13),(x+12,y+4),(x+w-12,y+4),(x+w-4,y+13)],g=.65,w=.3,close=False)
    self.line(x+w-4,y+15,x+w-4,y+h-13,.75,.3)
   elif k=='cipher':
    for xx,sgn in ((x+3,1),(x+w-3,-1)):
     self.poly([(xx,y+13),(xx,y+7),(xx+sgn*4,y+7),(xx+sgn*4,y+3),(xx+sgn*14,y+3)],g=.48,w=.4,close=False)
   elif k=='cinder':
    for xx in (x+5,x+w-5):
     for yy in (y+5,y+h-5):self.circle(xx,yy,1.1,.5,.3,1)
    self.line(x+13,y+h-3,x+w-13,y+h-3,.65,.3)
   elif k=='solstice':
    for dd in range(3):
     self.line(x+4+dd*2,y+12-dd*2,x+10+dd*2,y+4,.6,.3)
     self.line(x+w-4-dd*2,y+h-12+dd*2,x+w-10-dd*2,y+h-4,.6,.3)

 def band(self,title,x,y,w,small=False):
  if self.key=='aegis':return super().band(title,x,y,w,small)
  size=7.2 if small else 8.1;tw=min(w-12,pdfmetrics.stringWidth(title,'Head',size)+25);k=self.key
  if k in ('vesper','helix','tidal','nocturne','serein'):
   if k=='vesper':
    self.bezier_shape((x,y+8),[(x+10,y-1,x+tw*.7,y,x+tw-5,y+2),(x+tw+2,y+8,x+tw-5,y+16,x+tw-17,y+16),(x+17,y+16),(x+4,y+14,x,y+12,x,y+8)],fill=.16,g=.16,width=.4)
   elif k=='nocturne':self.bezier_shape((x,y+8),[(x+4,y+2,x+8,y,x+16,y),(x+tw-12,y),(x+tw-5,y,x+tw-2,y+4,x+tw,y+8),(x+tw-2,y+12,x+tw-5,y+17,x+tw-12,y+17),(x+16,y+17),(x+8,y+17,x+4,y+14,x,y+8)],fill=.16,g=.16,width=.4)
   else:self.roundbox(x,y,tw,17,7 if k=='helix' else 5,.16,.16,.4)
   for dd in (0,3):self.curve(x+tw+3,y+8+dd,x+tw+(w-tw)*.35,y+1+dd,x+w-28,y+16-dd,x+w-6,y+7+dd,g=.48+dd*.05,w=.4)
  else:
   if k=='cipher':pts=[(x,y),(x+tw-7,y),(x+tw,y+7),(x+tw,y+17),(x+7,y+17),(x,y+10)]
   elif k=='solstice':pts=[(x,y+4),(x+7,y+4),(x+7,y),(x+tw-8,y),(x+tw-8,y+4),(x+tw,y+4),(x+tw,y+13),(x+tw-8,y+13),(x+tw-8,y+17),(x,y+17)]
   elif k=='moire':pts=[(x,y+8),(x+9,y),(x+tw-9,y),(x+tw,y+8),(x+tw-9,y+17),(x+9,y+17)]
   elif k=='prism':pts=[(x,y+3),(x+tw-13,y+3),(x+tw,y+9),(x+tw-13,y+17),(x,y+17)]
   else:pts=[(x+5,y),(x+tw-5,y),(x+tw,y+5),(x+tw,y+12),(x+tw-5,y+17),(x+5,y+17),(x,y+12),(x,y+5)]
   self.poly(pts,fill=.16,g=.16,w=.4)
   self.line(x+tw+3,y+6,x+w-11,y+6,.45,.45);self.line(x+tw+3,y+11,x+w-11,y+11,.7,.3)
   if k=='cipher':
    self.poly([(x+tw+4,y+11),(x+tw+18,y+11),(x+tw+24,y+15),(x+w-13,y+15)],g=.65,w=.3,close=False)
   if k=='orrery':
    for xx in range(int(x+tw+10),int(x+w-17),12):self.line(xx,y+6,xx,y+9,.6,.3)
   if k=='moire':self.line(x+tw+10,y+13,x+w-17,y+3,.7,.3)
  self.text(title,x+11,y+4,size,'Head',1)
  if w-tw>25:self.motif(x+w-5,y+8,3.8)
  self.furniture.append({'page':self.page,'kind':'section_header','style':k,'title':title,'box':[x,y,x+w,y+17]})
  return y+18

 def rect(self,x,y,w,h,fill,stroke=None):
  if self.key=='aegis' or fill==1:return super().rect(x,y,w,h,fill,stroke)
  if h<=17 and w>40:
   # Filled category/table caps use the same construction as the chosen cards.
   cut=2.5 if self.key not in ORGANIC else 0
   if cut:self.poly([(x+cut,y),(x+w-cut,y),(x+w,y+cut),(x+w,y+h-cut),(x+w-cut,y+h),(x+cut,y+h),(x,y+h-cut),(x,y+cut)],fill=fill,g=fill,w=.1)
   else:self.roundbox(x,y,w,h,3,fill,fill,.1)
   self.line(x+4,y+h-1,x+w-4,y+h-1,.65,.3)
  else:super().rect(x,y,w,h,fill,stroke)

 def seal(self,x,y,r):
  k=self.key
  if k in ('vesper','helix','nocturne'):
   self.bezier_shape((x,y-r),[(x+r*1.15,y-r*.45,x+r*1.12,y+r*.5,x,y+r),(x-r*1.15,y+r*.5,x-r*1.15,y-r*.45,x,y-r)],fill=.94,g=.35,width=.6)
   self.curve(x,y-r+3,x-r*.75,y-r*.35,x-r*.75,y+r*.35,x,y+r-3,g=.6,w=.3)
  elif k in ('orrery','serein','tidal'):
   self.circle(x,y,r,.35,.6,.94);self.circle(x,y,r-3,.55,.3)
   if k=='orrery':
    for i in range(16):
     a=i*math.tau/16;self.line(x+math.cos(a)*(r-1),y+math.sin(a)*(r-1),x+math.cos(a)*(r+2),y+math.sin(a)*(r+2),.5,.3)
   elif k=='serein':self.curve(x+1,y-r+3,x-r+4,y-r*.4,x-r+4,y+r*.4,x+1,y+r-3,g=.4,w=.8)
   else:self.curve(x-r+3,y+r*.3,x-r*.3,y+r*.65,x+r*.3,y+r*.65,x+r-3,y+r*.3,g=.5,w=.35)
  elif k=='cinder':
   pts=[(x+(r if i%4 in (1,2) else r-2)*math.cos(i*math.tau/48),y+(r if i%4 in (1,2) else r-2)*math.sin(i*math.tau/48)) for i in range(48)]
   self.poly(pts,fill=.93,g=.35,w=.55);self.circle(x,y,r-4,.6,.3)
  elif k=='prism':
   self.poly([(x,y-r),(x+r*.88,y-r*.25),(x+r*.88,y+r*.25),(x,y+r),(x-r*.88,y+r*.25),(x-r*.88,y-r*.25)],fill=.93,g=.4,w=.6)
   self.poly([(x,y-r+3),(x+r*.7,y-r*.2),(x+r*.7,y+r*.2),(x,y+r-3),(x-r*.7,y+r*.2),(x-r*.7,y-r*.2)],g=.65,w=.3)
  elif k=='moire':self.ngon(x,y,r,4,fill=.93,w=.6);self.ngon(x,y,r-3,4,w=.3)
  elif k=='solstice':
   self.circle(x,y,r-3,.35,.55,.94)
   for i in range(16):
    a=i*math.tau/16;self.line(x+math.cos(a)*(r-2),y+math.sin(a)*(r-2),x+math.cos(a)*(r+1),y+math.sin(a)*(r+1),.45,.35)
   self.ngon(x,y,r-5,8,w=.3)
  else:self.ngon(x,y,r,6,fill=.93,w=.6);self.ngon(x,y,r-3,6,w=.3)

 def strap(self,x,y,w,h):
  if self.key in ORGANIC:self.roundbox(x,y,w,h,5,.17,.17,.3)
  elif self.key=='prism':self.poly([(x,y+2),(x+w-9,y+2),(x+w,y+h/2),(x+w-9,y+h),(x,y+h)],fill=.17,w=.3)
  elif self.key=='solstice':self.poly([(x,y+3),(x+4,y+3),(x+4,y),(x+w-4,y),(x+w-4,y+3),(x+w,y+3),(x+w,y+h),(x,y+h)],fill=.17,w=.3)
  elif self.key=='cipher':self.poly([(x,y),(x+w-6,y),(x+w,y+6),(x+w,y+h),(x+6,y+h),(x,y+h-6)],fill=.17,w=.3)
  else:self.poly([(x+4,y),(x+w-5,y),(x+w,y+5),(x+w-5,y+h),(x+4,y+h),(x,y+h-4),(x,y+4)],fill=.17,w=.3)

 def attribute_card(self,which,x,y,w,h,c=None,dense=False):
  name,practices=v7.GROUPS[which];self.molding(x,y,w,h,.982)
  rx=x+(23 if dense else 27);cy=y+(23 if dense else 25);rad=17 if dense else 20
  self.seal(rx,cy,rad);labelx=x+(44 if dense else 53)
  self.strap(labelx,y+7,w-(labelx-x)-6,17)
  self.text(name.upper(),labelx+5,y+11,7.5,'Head',1)
  if c:self.value(f"{c['conditionContext']['character']['attributes'][name.lower()]:+d}",rx,cy-7,14,'attribute_'+name.lower())
  else:self.text('+',rx-9,cy-5,10,'Head',g=.3);self.write(rx-1,cy-6,11,12,'attribute_'+name.lower())
  self.text('SAVE',labelx+4,y+30,6.1,'Head')
  if c:self.value(f"{[13,2,3][which]:+d}",x+w-24,y+26,10,'save_'+name.lower())
  else:self.write(labelx+36,y+25,w-(labelx-x)-47,14,'save_'+name.lower())
  lookup={p['practice']:p for p in c['practices']} if c else {}
  for j,p in enumerate(practices):
   if dense:px=x+13+(j%2)*(w-15)/2;yy=y+44+(j//2)*11.5;pw=(w-15)/2
   else:px=x+12;yy=y+51+j*11.5;pw=w-14
   row=lookup.get(p);tr=min(2,row['pbContribution']//5) if row else 0
   self.practice_mark(px+2,yy+3.5,p,tr);self.text(p.title(),px+10,yy,8.1 if dense else 8.5,'Body')
   if row:self.value(f"{row['total']:+d}",px+pw-14,yy-1,8.2 if dense else 9,'practice_'+p)
   else:self.write(px+pw-(22.5 if dense else 39),yy-2,15 if dense else 29,12,'practice_'+p)
  self.padding_cards.append({'page':self.page,'density':'dense' if dense else 'spacious','attribute':name,'box':[x,y,x+w,y+h],'minimum_practice_clearance':7})

 def attribute(self,which,x,y,w,h,c=None):
  if self.key=='aegis':return super().attribute(which,x,y,w,h,c)
  self.attribute_card(which,x,y,w,h+4,c)
 def compact_attribute(self,which,x,y,w,c=None):
  if self.key=='aegis':return super().compact_attribute(which,x,y,w,c)
  self.attribute_card(which,x,y,w,76,c,True)

 def write(self,x,y,w,h,role):
  super().write(x,y,w,h,role)
  if self.key=='aegis':return
  if role in ('capability_record','effect_record'):
   # Surface grammar differs across every blank capability/effect record.
   if self.key in ORGANIC:
    self.curve(x,y+3,x-2,y+h*.35,x-2,y+h*.7,x,y+h-2,g=.66,w=.35)
    self.curve(x+w,y+3,x+w+2,y+h*.35,x+w+2,y+h*.7,x+w,y+h-2,g=.66,w=.35)
   elif self.key=='cipher':
    self.poly([(x,y+7),(x,y+2),(x+7,y+2)],g=.5,w=.4,close=False)
    self.poly([(x+w-7,y+2),(x+w,y+2),(x+w,y+7)],g=.5,w=.4,close=False)
   elif self.key=='orrery':
    for xx in range(int(x+2),int(x+w-2),18):self.line(xx,y+h-1,xx,y+h-3,.6,.3)
   elif self.key=='moire':self.poly([(x,y+6),(x+5,y+1),(x+w-5,y+1),(x+w,y+6)],g=.7,w=.3,close=False)
   else:
    self.line(x,y+3,x+8,y+3,.55,.4);self.line(x+w-8,y+3,x+w,y+3,.55,.4)
  elif role not in ('portrait_sketch',) and w>27:
   if self.key in ('cipher','cinder'):self.line(x,y+h-3,x,y+h-1,.5,.45);self.line(x+w,y+h-3,x+w,y+h-1,.5,.45)
   elif self.key in ('orrery','solstice'):self.line(x+2,y+h-1,x+2,y+h-2.5,.65,.3)

 def inner_structure(self,normal=False):
  if self.key=='aegis':return super().inner_structure(normal)
  for yy in ((646,789) if normal else (682,790)):
   self.line(29,yy,34,yy,.5,.5);self.line(R+2,yy,W-29,yy,.5,.5)
  if normal and self.arch!='stack':
   xx=391 if self.arch=='right' else 204
   self.line(xx,307,xx,629,.77,.35)
   for yy in (326,631):self.motif(xx,yy,2.5)

 def access(self,x,y,w,c=None,vertical=False,source_rows=None):
  if vertical or w>400:return super().access(x,y,w,c,vertical,source_rows)
  rows=source_rows if source_rows is not None else v6.records(c) if c else []
  owned={cat:{v7.access_option(r) for r in rows if r['category']==cat} for cat in v7.ACCESS}
  self.band('OWNED ACCESS',x,y,w,True);self.text('Verbs:',x+7,y+24,8.0,'Body')
  for i,t in enumerate(v9.TIER_LABELS):self.check(x+58+i*66,y+23,v9.TIER_LABELS[t],'verb_tier',t in owned['VERB_TIER'],8.5)
  self.text('DOMAINS',x+7,y+46,6.3,'Head');self.write(x+70,y+39,w-79,18,'domains')
  self.text('RANGE',x+7,y+66,6.2,'Head')
  for i,t in enumerate(v7.RANGES):self.check(x+7+i*(w-14)/6,y+80,t,'range',t in owned['RANGE'],7.8,v7.DISTANCES[i])
  self.text('DIE',x+7,y+112,6.2,'Head')
  for i,t in enumerate(v7.DICE):self.check(x+43+i*42,y+109,t,'output_die',t in owned['INTENSITY_DICE'],8)
  self.text('Dots = owned pieces / scope follows each rule',x+7,y+127,6.6,'Body',g=.3)

 def live_column(self,x,y,w,c=None):
  self.band('VITALITY / RECOVERY',x,y,w,True)
  for i,(label,a,b) in enumerate([('VITALITY MAX / CURRENT','max_vitality','current_vitality'),('REST CAP / LEFT','recovery_cap','recovery_remaining')]):
   yy=y+25+i*40;self.text(label,x+8,yy,6.2,'Head');self.write(x+8,yy+11,49,20,a);self.text('/',x+64,yy+15,11,'Display');self.write(x+78,yy+11,w-87,20,b)
  for i,label in enumerate(['DC','PB']):
   xx=x+8+i*w/2;self.text(label,xx,y+111,6.3,'Head');self.write(xx+23,y+105,w/2-34,20,label.lower())
  self.text('MOVEMENT / ft',x+8,y+130,6.3,'Head');self.text('W ___ C ___ S ___ F ___',x+8,y+141,8.1,'Body')
  self.text('USED',x+8,y+157,6.1,'Head');self.write(x+42,y+150,w-51,15,'movement_used')

 def front(self,density='normal',c=None,rows=None):
  if self.key=='aegis' or density=='compact':return super().front(density,c,rows)
  assert c is None and rows is None,'Examples use the complete compact front.'
  self.begin('front / normal','NORMAL / CHARACTER INSTRUMENT');self.identity();self.inner_structure(True)
  if self.arch=='stack':
   for i,(yy,hh) in enumerate([(139,90),(240,101),(354,90)]):self.attribute(i,L,yy,159,hh)
   self.text('Practice hex: empty / dot proficient / filled expert.',L+3,453,6.1,'Body',g=.3)
   self.live_column(L,472,159);self.access(216,139,R-216);self.ledger(216,286,R-216,637)
  else:
   self.vital_bar(131);w=(R-L-2*GAP)/3
   for i in range(3):self.attribute(i,L+i*(w+GAP),183 if i==1 else 194,w,101 if i==1 else 90)
   self.text('Practice hex: empty untrained / dot proficient / filled expertise.',L+5,292,6.4,'Body',g=.25)
   if self.arch=='right':self.ledger(L,305,343.276,637);self.access(R-159,305,159,vertical=True)
   else:self.access(L,305,159,vertical=True);self.ledger(216,305,R-216,637)
  self.text('ONGOING / ENDING',L+2,643,6.3,'Head');self.write(L+105,639,R-L-105,14,'ongoing_endings')
  self.scaling(658);self.footer_state();self.end();self.roles[-1]['density_name']='spacious'

 def ledger(self,x,y,w,bottom,c=None,rows=None,dense=False):
  remaining=super().ledger(x,y,w,bottom,c,rows,dense)
  if self.key!='aegis':
   if c is None and rows is None:
    cols=2 if dense else 1;cw=(w-(GAP if dense else 0))/cols
    for col in range(cols):
     xx=x+col*(cw+GAP)+10
     if self.key in ORGANIC:self.curve(xx,y+35,xx-4,y+90,xx+4,bottom-90,xx,bottom-4,g=.72,w=.35)
     elif self.key in ('orrery','cinder','cipher'):
      for yy in range(int(y+42),int(bottom-2),22):self.line(xx-3,yy,xx,yy,.6,.4)
     elif self.key=='moire':self.line(xx-3,y+32,xx-3,bottom,.75,.3)
   self.furniture.append({'page':self.page,'kind':'primitive_ledger','style':self.key,'columns':2 if dense else 1})
  return remaining

 def table_row(self,y,h,starts):
  # Different table architecture, kept outside the writable cell interiors.
  k=self.key
  if k in ('orrery','cipher','cinder','solstice','prism'):
   for dx in starts[1:]:self.line(L+dx-2,y-2,L+dx-2,y+h-2,.7,.3)
  elif k=='moire':
   for dx in starts[1:]:self.line(L+dx-3,y-2,L+dx-3,y+h-2,.8,.25);self.line(L+dx-1,y-2,L+dx-1,y+h-2,.8,.25)
  if k in ORGANIC:
   for dx in starts[1:]:self.line(L+dx-2,y,L+dx-2,y+h-4,.73,.28)
   self.line(L+7,y+h-2,R-7,y+h-2,.68,.35)
   self.curve(L,y+h-4,L+1,y+h-2,L+4,y+h-2,L+7,y+h-2,g=.55,w=.4)
   self.curve(R-7,y+h-2,R-4,y+h-2,R-1,y+h-2,R,y+h-4,g=.55,w=.4)
   if k=='helix':self.circle(R-1,y+h-2,.8,.5,.25)
   elif k=='tidal':
    for dx in (1,3,5):self.line(R-dx,y+h-2,R-dx,y+h-.5,.6,.25)
   elif k=='vesper':self.curve(L,y+h-2,L+2,y+h-.5,L+4,y+h-.5,L+6,y+h-2,g=.6,w=.25)
   elif k=='nocturne':self.curve(R-6,y+h-2,R-4,y+h+.5,R-2,y+h+.5,R,y+h-2,g=.6,w=.25)
   elif k=='serein':self.curve(L,y+h-2,L+1,y+h,L+3,y+h,L+4,y+h-2,g=.55,w=.3)
  else:self.line(L,y+h-2,R,y+h-2,.65,.35)
  if k=='orrery':
   for dx in starts[2:]:self.line(L+dx-2,y+h-4,L+dx+1,y+h-4,.6,.3)
  if k=='prism':self.poly([(L,y+h-5),(L+3,y+h-2),(L,y+h-2)],fill=.8,g=.8,w=.2)

 def equipment(self,c=None):
  if self.key=='aegis':return super().equipment(c)
  self.begin('filled equipment' if c else 'blank equipment','EQUIPMENT / LOAD / ITEM RULES',c['name'] if c else None)
  self.page_heading('Carried & equipped',c['name'] if c else None)
  self.band('EQUIPMENT / QUANTITY / LOAD / EQUIPPED SLOTS',L,157,R-L)
  self.text('Character BU and Item BU are separate. Record actual quantities and item-only rules.',L+8,181,8.1,'Body')
  starts=[0,21,273,310,353,398,453];ends=[18,269,306,349,394,449,R-L];labels=['EQ','ITEM / REF','QTY','LOAD','SLOTS','ITEM BU','STATE']
  if self.key in ('orrery','cinder','cipher','solstice'):
   for i,dx in enumerate(starts):
    width=ends[i]-dx;self.rect(L+dx,199,width,16,.91)
    if self.key=='cinder':self.line(L+dx+2,200,L+ends[i]-2,200,.55,.4)
  else:self.rect(L,199,R-L,16,.92)
  for dx,label in zip(starts,labels):self.text(label,L+dx+3,204,6.3,'Head')
  count=len(c['itemLinks']) if c else 24;rh=18 if c else 13.4
  for i in range(count):
   y=220+i*rh;self.table_row(y,rh,starts);self.check(L+4,y+3,'','equipped',bool(c and c['itemLinks'][i]['equipped']))
   if c:
    ln=c['itemLinks'][i];it=ln['item'];load={'TINY':1,'SMALL':1,'MEDIUM':2,'LARGE':4,'HUGE':8,'GARGANTUAN':16}[it['size']]*ln['quantity']
    vals=[f'I{i+1:02} / '+it['name'],str(ln['quantity']),str(load),str(it['slotCost'] if ln['equipped'] else 0),str(it['buCost']*ln['quantity']),'equipped' if ln['equipped'] else 'carried']
    for j,val in enumerate(vals,1):self.text(val,L+starts[j]+3,y+3,9 if j==1 else 8.1,'Body')
    self.source_blocks.append({'page':self.page,'name':vals[0],'table_values':vals,'quantity':ln['quantity'],'load':load,'equipped_slots':int(vals[3]),'item_bu':int(vals[4])})
   else:
    for j in range(1,7):self.writing.append({'page':self.page,'role':'item_'+labels[j].lower().replace(' / ','_').replace(' ','_'),'box':[L+starts[j]+3,y,L+ends[j]-2,y+rh-3]})
  self.tables.append({'page':self.page,'kind':'equipment','style':self.key,'rows':count,'columns':labels})
  ty=220+count*rh+10
  self.text('SLOTS used / max',L+4,ty,6.4,'Head');self.write(L+99,ty-5,45,17,'slots_current');self.text('/ '+str(c['encumbrance']['equipSlotsAvailable']) if c else '/ ___',L+148,ty-1,9,'Body')
  self.text('LOAD / capacity',L+206,ty,6.4,'Head');self.write(L+296,ty-5,46,17,'load_current');self.text('/ '+str(c['carryCapacity']) if c else '/ ___',L+347,ty-1,9,'Body')
  self.text('ITEM BU',R-84,ty,6.4,'Head')
  if c:self.text(str(c['buBalance']['itemBuSpent']),R-20,ty-1,9,'Head')
  else:self.write(R-35,ty-5,32,17,'item_bu_total')
  if c:
   self.band('ITEM RULES / EACH RULE STAYS WITH ITS SOURCE',L,ty+30,R-L)
   assert not self.flow_source(self.content_records(c,'items'),ty+59,791,size=9.3,leading=11.2)
   last=max(self.last_flow_ends)
   if 791-last>100:
    self.band('CONSUMABLES / REPAIRS / TEMPORARY ITEM STATE',L,last+20,R-L,True)
    for yy in range(int(last+48),779,14):self.write(L+5,yy,R-L-10,14,'item_scene_notes')
  else:
   self.band('ITEM RULES / SOURCE / LIMITS / ENDING',L,579,R-L)
   for col in range(2):
    x=L+col*(CW+GAP);self.molding(x,609,CW,112,1);self.text('ITEM / REF',x+10,620,6.3,'Head');self.write(x+75,614,CW-90,18,'item_reference')
    for yy in (641,655,669,683,697):self.write(x+10,yy,CW-23,13,'item_rule')
   self.band('RESOURCES / QUANTITIES / NOTES',L,738,R-L,True)
   for yy in (762,778):self.write(L+7,yy,R-L-14,14,'resource_notes')
  self.end()

 def save(self):
  d=super().save();d.update({'design_brief':self.brief,'normal_architecture':self.arch,'native_furniture':self.furniture,'panels':self.panels,'tables':self.tables})
  r=PdfReader(d['path']);w=PdfWriter();w.clone_document_from_reader(r)
  w.add_metadata({'/Title':f'SwordWeave / {self.name} / complete normal and compact character folio','/Subject':'Twelve-style local print-and-pencil collection / v10'})
  with Path(d['path']).open('wb') as stream:w.write(stream)
  d['sha256']=sha(d['path']);return d

def build(index,style):
 f=Folio(index,style);f.front();f.front('compact');f.capabilities();f.equipment();f.workbench();f.continuation();f.identity_page();f.primitive_overflow()
 c=v6.ORREN;f.front('compact',c);f.capabilities(c);f.equipment(c);f.identity_page(c);f.full_primitive_rules(c)
 return f.save()

def main():
 designs=[]
 for i,style in enumerate(STYLES,1):designs.append(build(i,style))
 (OUT/'manifest.json').write_text(json.dumps({'designs':designs,'source_snapshots':[v6.OSOURCE],'rules_sources':['src/lib/capabilities/table-guidance.ts','src/lib/rules/play-guide.ts'],
 'approved_baseline':'Complete Aegis v9. Twelve coordinated styles authorized 22 October 2026.',
 'scope':'Local PDFs only; normal and compact fronts share coordinated repeatable supporting leaves.'},indent=2)+'\n')
if __name__=='__main__':main()
