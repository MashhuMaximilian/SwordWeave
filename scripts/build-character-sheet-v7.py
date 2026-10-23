#!/usr/bin/env python3
"""Two integrated print instruments, with explicit owned access / declared scale.

v6 supplies unchanged source extraction and low-level PDF primitives only.
The page architecture, furniture and every worksheet are new here.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import importlib.util, json, hashlib, math, re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v6_source_helpers', ROOT/'scripts/build-character-sheet-v6.py')
v6 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v6)
W,H = v6.W,v6.H
L,R = 36.,W-36.
GAP=15.; CW=(R-L-GAP)/2
OUT=ROOT/'output/publications/character-sheets-v7'
TMP=ROOT/'tmp/pdfs/character-sheets-v7'
for p in (OUT,TMP):p.mkdir(parents=True,exist_ok=True)
AXES = [
 ('Targets',['Single','Multiple','Area','Custom']),
 ('Shape',['Direct','Cone','Line','Sphere','Zone','Beam','Custom']),
 ('Size',['One target','5 ft','10 ft','20 ft','Custom']),
 ('Placement',['Self','Target','Point','Directional','Custom']),
 ('Effect duration',['Instant','Short','Medium','Long','Scene','Persistent','Permanent','Custom']),
 ('Casting time',['Action','Reaction','Instant','Short','Medium','Long','Scene','Custom']),
]
RANGES=['Touch','Close','Near','Far','Very Far','Extreme']
DISTANCES=['5 ft','5–10 ft','30 ft','60 ft','120 ft','240 ft–3 mi']
DICE=['None','d4','d6','d8','d10','d12','d20']
ACCESS={'VERB_TIER','DOMAIN','RANGE','INTENSITY_DICE'}
GROUPS=[('Physical',['prowess','finesse','fieldcraft']),('Mental',['awareness','reason','knowledge','influence']),('Magical',['mysticism','communion','intuition'])]

def access_option(row):
 cat=row['category']
 if cat=='VERB_TIER':return re.search(r'\b(IV|III|II|I)\b',row['name']).group(1)
 if cat=='RANGE':return row['name'].replace(' Range','')
 if cat=='INTENSITY_DICE':return re.search(r'd\d+',row['name']+' '+row['rule']).group(0)
 return v6.vocabulary_value(row)

class Instrument(v6.Folio):
 def __init__(self,key,number,path=None):
  self.key,self.name,self.number=key,key.title(),number
  self.path=path or ROOT/f'output/pdf/swordweave-character-sheet-v7-{number}-{key}.pdf'
  self.raw=TMP/self.path.name
  self.c=canvas.Canvas(str(self.raw),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Body')
  self.page=0;self.roles=[];self.texts=[];self.writing=[];self.marks=[];self.placed=[];self.art=[];self.choices=[];self.numeric=[]
  self.master=ROOT/f'output/publications/character-sheets-v6/assets/{key}-frame.png'
  im=Image.open(self.master).convert('RGBA')
  self.art_image=ImageReader(Image.merge('LA',(im.convert('L'),im.getchannel('A'))));self.iw,self.ih=im.size

 def rect(self,x,y,w,h,fill,stroke=None):
  c=self.c;c.saveState();c.setFillGray(fill)
  if stroke is not None:c.setStrokeGray(stroke)
  c.rect(x,H-y-h,w,h,fill=1,stroke=int(stroke is not None));c.restoreState()

 def bezier_shape(self,start,segments,fill=.96,g=.25,width=.6):
  c=self.c;c.saveState();c.setFillGray(fill);c.setStrokeGray(g);c.setLineWidth(width)
  p=c.beginPath();p.moveTo(start[0],H-start[1])
  for seg in segments:
   if len(seg)==2:p.lineTo(seg[0],H-seg[1])
   else:p.curveTo(seg[0],H-seg[1],seg[2],H-seg[3],seg[4],H-seg[5])
  p.close();c.drawPath(p,stroke=1,fill=1);c.restoreState()

 def jewel(self,x,y,r=4,filled=False):
  self.ngon(x,y,r,6 if self.key=='vesper' else 4,fill=.15 if filled else 1,w=.55)
  if self.key=='aegis':self.line(x-r+1,y,x+r-1,y,.65,.28)

 def leaf(self,x,y,w,h,flip=False):
  s=-1 if flip else 1
  self.bezier_shape((x,y),[(x+s*w*.05,y-h*.65,x+s*w*.5,y-h,x+s*w,y-h),
    (x+s*w*.98,y-h*.3,x+s*w*.55,y+h*.2,x,y)],fill=.93,g=.48,width=.35)
  self.curve(x,y,x+s*w*.45,y-h*.7,x+s*w*.75,y-h*.65,x+s*w,y-h,g=.5,w=.25)

 def molding(self,x,y,w,h,fill=.975):
  """The native section structure follows the selected frame's vocabulary."""
  if self.key=='aegis':
   pts=[(x+8,y),(x+w-14,y),(x+w,y+14),(x+w,y+h-8),(x+w-8,y+h),(x+14,y+h),(x,y+h-14),(x,y+8)]
   self.poly(pts,g=.3,w=.65,fill=fill)
   self.poly([(x+4,y+11),(x+12,y+4),(x+w-16,y+4),(x+w-5,y+15)],g=.7,w=.3,close=False)
   self.poly([(x+w-4,y+h-12),(x+w-12,y+h-4),(x+16,y+h-4),(x+5,y+h-15)],g=.6,w=.3,close=False)
  else:
   self.bezier_shape((x+15,y),[(x+w*.36,y+5,x+w*.8,y-5,x+w-7,y),
    (x+w+4,y+14,x+w-6,y+h*.8,x+w-16,y+h),
    (x+w*.6,y+h-4,x+w*.15,y+h+2,x+6,y+h),
    (x-4,y+h*.6,x-3,y+15,x+15,y)],fill=fill,g=.4,width=.5)
   self.curve(x+3,y+h-6,x-10,y+h*.5,x-5,y+16,x+15,y+4,g=.68,w=.3)

 def band(self,title,x,y,w,small=False):
  """A filled structural rib, rather than an isolated label on a line."""
  size=7.2 if small else 8.1
  tw=min(w-15,pdfmetrics.stringWidth(title,'Head',size)+29)
  if self.key=='vesper':
   self.bezier_shape((x,y+9),[(x+13,y-4,x+tw*.27,y,x+tw*.54,y),
    (x+tw*.8,y,x+tw-5,y-1,x+tw,y+5),(x+tw-11,y+17,x+tw*.7,y+16,x+tw*.45,y+16),
    (x+20,y+15,x+3,y+19,x,y+9)],fill=.18,g=.18,width=.35)
   if w-tw>30:
    for j in range(3):
     self.curve(x+tw-6,y+7+j*2,x+tw+(w-tw)*.3,y-5+j*3,x+w-44,y+20-j*2,x+w,y+7,g=.4+j*.12,w=.38)
    self.leaf(x+w-2,y+10,14,11)
    self.leaf(x+tw+17,y+10,12,9)
    self.jewel(x+w-22,y+9,2.0)
   self.text(title,x+12,y+3,size,'Head',1)
  else:
   self.poly([(x,y+5),(x+6,y),(x+tw-13,y),(x+tw,y+13),(x+tw-6,y+17),(x+12,y+17),(x,y+10)],fill=.13,g=.13,w=.4)
   self.line(x+12,y+15,x+tw-7,y+15,.6,.3)
   if w-tw>30:
    for j in range(3):
     self.poly([(x+tw-5,y+4+j*3),(x+tw+7+j*2,y+4+j*3),(x+tw+13+j*2,y+10+j*2),(x+w-13-j*3,y+10+j*2),(x+w-3,y+2+j*3)],g=.38+j*.14,w=.35,close=False)
    self.ngon(x+w-7,y+6,5,4,fill=.94,w=.4)
   self.text(title,x+11,y+4,size,'Head',1)

 def etched_joint(self,x,y,vertical=False):
  """Fine structural engraving, kept outside labels and pencil fields."""
  if self.key=='aegis':
   for i in range(4):
    d=i*2.2
    self.poly([(x-d,y+8),(x-d,y-d),(x+12,y-d)],g=.52,w=.3,close=False)
   self.jewel(x+12,y-6,2)
  else:
   self.curve(x,y+13,x-7,y+4,x-5,y-7,x+10,y-10,g=.48,w=.45)
   self.curve(x+3,y+12,x-1,y+2,x+1,y-5,x+11,y-7,g=.65,w=.3)
   self.leaf(x+1,y+6,9,12)

 def inner_structure(self,normal=False):
  # These ribs join the working regions to the engraved side structure.
  # They are deliberately outside all native text / writing reservations.
  if self.key=='vesper' and normal:
   self.curve(204,145,188,194,212,222,204,266,g=.6,w=.5)
   self.curve(204,266,194,320,213,353,205,405,g=.6,w=.5)
   self.curve(205,405,194,455,210,504,205,548,g=.6,w=.5)
   for yy in (225,338,450):self.etched_joint(204,yy)
  elif self.key=='aegis' and normal:
   self.poly([(194,176),(203,183),(203,295),(207,301)],g=.6,w=.45,close=False)
   self.poly([(385,176),(391,183),(391,286),(397,295)],g=.6,w=.45,close=False)
   for xx in (206,394):self.etched_joint(xx,297)
  for yy in ((646,789) if normal else (682,790)):
   self.line(28,yy,34,yy,.48,.6);self.line(R+2,yy,W-28,yy,.48,.6)

 def begin(self,role,subtitle,character=None):
  self.page+=1;self.roles.append({'page':self.page,'role':role,'character':character})
  # Reuse the liked masters at their native resolution. Native ribs extend
  # their visual language across the writable page, not just around its edge.
  for j in range(3):
   for src,x in [((0,330,180,1045),8),((844,330,180,1045),W-27)]:
    self.frame_piece(src,(x,100+j*230,19,230))
  for x in (8,W-27):
   for y in (100,330,560,790):
    if self.key=='aegis':
     self.poly([(x-1,y-3),(x+4,y-5),(x+15,y-5),(x+20,y),(x+15,y+5),(x+4,y+5),(x-1,y+3)],fill=.94,g=.4,w=.35)
    else:
     self.curve(x,y-3,x+4,y-8,x+17,y-8,x+19,y-3,g=.3,w=.65)
     self.curve(x,y+3,x+4,y+8,x+17,y+8,x+19,y+3,g=.3,w=.65)
  self.frame_piece((0,0,1024,400),(L,3,178,69.53))
  self.frame_piece((315,1375,395,161),(W/2-35,805,70,28.53))
  self.text('S W O R D W E A V E',232,19,9.8,'Label')
  self.text(self.name.upper(),R,20,8.6,'Head',align='right')
  self.text(subtitle,232,38,7.2,'Head')
  if self.key=='vesper':
   self.curve(212,49,240,47,255,55,R,51,g=.45,w=.45)
  else:
   self.poly([(216,49),(232,54),(R-10,54),(R,44)],g=.4,w=.5,close=False)
  self.text('v0.1 ALPHA / PRINT + PENCIL',L,820,6.1,'Label',g=.25)
  self.text(str(self.page).zfill(2),R,819,8,'Head',align='right')
  self.c.bookmarkPage('page-'+str(self.page));self.c.addOutlineEntry(subtitle,'page-'+str(self.page),0,False)

 def identity(self,c=None):
  self.text('NAME',232,60,6.0,'Head',g=.25)
  if c:self.text(c['name'],232,72,20,'Display')
  else:self.write(232,71,R-232,23,'name')
  self.text('CONCEPT / HERITAGES',L,94,6.2,'Head')
  if c:self.plain(' / '.join(h['heritage']['name'] for h in c['heritageLinks']),L,106,326,9.6,11.4)
  else:self.write(L,104,326,18,'concept_heritages')
  x=388;self.text('LEVEL / BUDGET',x,94,6.2,'Head')
  if c:
   b=c['buBalance'];self.text(f"{c['level']} / {b['progressionSpent']} of {b['progressionPool']} BU / {b['progressionRemaining']} free",x,108,8.0,'Head')
  else:self.write(x,104,R-x,18,'level_budget')

 def value(self,value,x,y,size,role):
  self.text(value,x,y,size,'Head',align='center')
  self.numeric.append({'page':self.page,'role':role,'value':str(value)})

 def attribute(self,which,x,y,w,h,c=None):
  name,practices=GROUPS[which]
  self.molding(x,y,w,h,.975)
  cy=y+25;rx=x+27
  if self.key=='vesper':
   self.leaf(x-1,y+54,10,26)
   self.leaf(x+w+1,y+h-3,10,10)
   self.ngon(rx,cy,21,6,fill=.92,w=.7);self.ngon(rx,cy,18,6,w=.3)
  else:
   self.ngon(rx,cy,21,8,fill=.91,w=.7);self.ngon(rx,cy,18,8,w=.3)
   self.poly([(x+4,y+12),(x+9,y+7),(x+13,y+7)],g=.4,w=.6,close=False)
  labelx=x+53;labelw=w-61
  if self.key=='vesper':
   self.bezier_shape((labelx,y+9),[(labelx+labelw*.4,y+7,labelx+labelw*.75,y+13,labelx+labelw,y+6),
     (labelx+labelw-2,y+25),(labelx+labelw*.5,y+22,labelx+7,y+26,labelx,y+24)],fill=.18,g=.18,width=.3)
  else:self.poly([(labelx,y+8),(x+w-10,y+8),(x+w-4,y+15),(x+w-10,y+24),(labelx,y+24)],fill=.17,w=.3)
  self.text(name.upper(),labelx+5,y+13,7.5,'Head',1)
  if c:
   val=c['conditionContext']['character']['attributes'][name.lower()]
   self.value(f'{val:+d}',rx,cy-7,15,'attribute_'+name.lower())
  else:
   self.text('+',rx-11,cy-5,10,'Head',g=.25);self.write(rx-3,cy-8,16,20,'attribute_'+name.lower())
  self.text('SAVE',labelx+3,y+32,6.2,'Head',g=.25)
  saves=([13,2,3] if c and c['name']==v6.ORREN['name'] else [4,3,18]) if c else []
  if c:self.value(f'{saves[which]:+d}',x+w-23,y+29,10,'save_'+name.lower())
  else:self.write(labelx+37,y+29,labelw-38,13,'save_'+name.lower())
  rows={p['practice']:p for p in c['practices']} if c else {}
  # Three/four pencil-practical rows. Training and value remain distinct.
  for j,p in enumerate(practices):
   yy=y+51+j*11.5
   row=rows.get(p);tr=min(2,row.get('pbContribution',0)//5) if row else 0
   self.practice_mark(x+14,yy+3.5,p,tr)
   self.text(p.title(),x+23,yy,8.5,'Body')
   if row:self.value(f"{row['total']:+d}",x+w-21,yy-1,9,'practice_'+p)
   else:self.write(x+w-39,yy-2,29,12,'practice_'+p)

 def vital_bar(self,y,c=None):
  self.molding(L,y,R-L,43,1)
  widths=[144,117,47,47,R-L-355];x=L+7
  for i,w in enumerate(widths):
   title=['VITALITY','SHORT REST','DC','PB','MOVEMENT / ft'][i]
   self.text(title,x+2,y+5,6.3,'Head')
   if i in (0,1):
    self.text('MAX' if i==0 else 'CAP',x+2,y+17,5.5,'Label',g=.3)
    self.text('CURRENT' if i==0 else 'LEFT',x+61,y+17,5.5,'Label',g=.3)
    val=(c['vitality']['max'] if i==0 else (c['vitality']['max']+1)//2) if c else None
    if c:self.value(val,x+23,y+26,12,'vitality_max' if i==0 else 'rest_cap')
    else:self.write(x+3,y+25,44,15,'max_vitality' if i==0 else 'recovery_cap')
    self.write(x+61,y+25,w-69,15,'current_vitality' if i==0 else 'recovery_remaining')
   elif i in (2,3):
    if c:self.value('18' if i==2 else '+5',x+w/2-3,y+23,13,title.lower())
    else:self.write(x+3,y+23,w-13,17,title.lower())
   else:
    speed='W 30 / C 15 / S 15'+(' / F 30' if c and c['name']==v6.ASTER['name'] else '') if c else 'W ___ C ___ S ___ F ___'
    self.text(speed,x+2,y+17,7.8,'Body')
    self.text('USED',x+2,y+31,5.6,'Label',g=.3);self.write(x+29,y+28,w-40,12,'movement_used')
   x+=w
   if i<4:self.line(x-4,y+6,x-4,y+37,.65,.35)

 def compact_attribute(self,which,x,y,w,c=None):
  name,practices=GROUPS[which];self.molding(x,y,w,68,.975)
  rx=x+23;cy=y+23
  self.ngon(rx,cy,18,6 if self.key=='vesper' else 8,fill=.91,w=.65)
  self.ngon(rx,cy,15,6 if self.key=='vesper' else 8,w=.25)
  if c:self.value(f"{c['conditionContext']['character']['attributes'][name.lower()]:+d}",rx,cy-7,14,'attribute_'+name.lower())
  else:
   self.text('+',rx-10,cy-5,10,'Head',g=.3);self.write(rx-2,cy-8,14,20,'attribute_'+name.lower())
  self.poly([(x+44,y+7),(x+w-10,y+7),(x+w-4,y+14),(x+w-10,y+22),(x+44,y+22)],fill=.17,w=.3)
  self.text(name.upper(),x+49,y+11,7.6,'Head',1)
  self.text('SAVE',x+49,y+29,6.1,'Head')
  if c:
   saves=[13,2,3] if c['name']==v6.ORREN['name'] else [4,3,18]
   self.value(f'{saves[which]:+d}',x+w-24,y+25,10,'save_'+name.lower())
  else:self.write(x+82,y+24,w-93,15,'save_'+name.lower())
  lookup={p['practice']:p for p in c['practices']} if c else {}
  for j,p in enumerate(practices):
   px=x+9+(j%2)*(w-15)/2;yy=y+44+(j//2)*11.5;pw=(w-15)/2
   row=lookup.get(p);tr=min(2,row.get('pbContribution',0)//5) if row else 0
   self.practice_mark(px+2,yy+3.5,p,tr)
   self.text(p.title(),px+10,yy,8.1,'Body')
   if row:self.value(f"{row['total']:+d}",px+pw-14,yy-1,8.2,'practice_'+p)
   else:self.write(px+pw-21,yy-2,17,12,'practice_'+p)

 def live_column(self,x,y,w,c=None):
  self.band('VITALITY / RECOVERY',x,y,w,True)
  for index,(label,role,val) in enumerate([
   ('VITALITY MAX / CURRENT','vitality',c['vitality']['max'] if c else None),
   ('REST CAP / LEFT','rest',(c['vitality']['max']+1)//2 if c else None)]):
   yy=y+27+index*45;self.text(label,x+9,yy,6.3,'Head')
   if c:self.value(val,x+35,yy+14,14,role+'_max')
   else:self.write(x+8,yy+13,49,22,role+'_max')
   self.text('/',x+62,yy+19,12,'Display',g=.4);self.write(x+77,yy+13,w-86,22,'current_vitality' if index==0 else 'recovery_remaining')
  for i,label in enumerate(['DC','PB']):
   xx=x+8+i*w/2;self.text(label,xx,y+119,6.4,'Head')
   if c:self.value('18' if i==0 else '+5',xx+42,y+115,12,label.lower())
   else:self.write(xx+22,y+113,w/2-32,20,label.lower())
  self.text('MOVEMENT / ft',x+9,y+144,6.3,'Head')
  self.text('Walk ___ Climb ___ Swim ___',x+9,y+156,8.0,'Body')
  self.text('Fly ___  Used this round ___',x+9,y+169,8.0,'Body')

 def check(self,x,y,label,family,checked=False,size=8.3,secondary=None,meaning='owned'):
  # One point or fill, in the same visual vocabulary as practice marks.
  self.ngon(x+3,y+4,3.1,6 if meaning=='owned' else 4,fill=1,w=.45)
  if checked:
   self.c.saveState();self.c.setFillGray(.05);self.c.circle(x+3,H-y-4,1.3,stroke=0,fill=1);self.c.restoreState()
  self.text(label,x+11,y,size,'Body')
  if secondary:self.text(secondary,x+11,y+10,5.8,'Label',g=.3)
  self.choices.append({'page':self.page,'family':family,'option':label,'selected':bool(checked),'meaning':meaning,'box':[x,y,x+7,y+8]})
  return 11+pdfmetrics.stringWidth(label,'Body',size)+7

 def access(self,x,y,w,c=None,vertical=False,source_rows=None):
  rows=source_rows if source_rows is not None else v6.records(c) if c else []
  owned={cat:{access_option(r) for r in rows if r['category']==cat} for cat in ACCESS}
  self.band('OWNED ACCESS',x,y,w,True)
  if w>400:self.text('Dot = owned piece / scope per rule',x+w-165,y-10,6.1,'Body',g=.25)
  if vertical:
   self.molding(x,y+23,w,296,1)
   self.text('VERB TIERS',x+12,y+32,6.8,'Head')
   for i,t in enumerate(['I','II','III','IV']):self.check(x+13+i*34,y+48,t,'verb_tier',t in owned['VERB_TIER'],9)
   self.text('DOMAINS',x+12,y+72,6.8,'Head')
   domain=' / '.join(r['ref']+' '+access_option(r) for r in rows if r['category']=='DOMAIN')
   if c or source_rows is not None:self.plain(domain or 'None recorded',x+12,y+86,w-24,8.6,10.8)
   else:
    self.write(x+12,y+84,w-24,16,'domains');self.write(x+12,y+102,w-24,16,'domains')
   self.text('RANGE',x+12,y+127,6.8,'Head')
   for i,t in enumerate(RANGES):self.check(x+12+(i%2)*75,y+144+(i//2)*25,t,'range',t in owned['RANGE'],8.0,DISTANCES[i])
   self.text('OUTPUT DIE',x+12,y+224,6.8,'Head')
   for i,t in enumerate(DICE):self.check(x+12+(i%4)*36,y+241+(i//4)*20,t,'output_die',t in owned['INTENSITY_DICE'],8)
   self.plain('Dots record purchased pieces. Their authored scope still applies.',x+12,y+283,w-25,7.6,9.1)
  else:
   # The wide normal wing is deeper; compact is a shallow full-width rail.
   narrow=w<400
   if narrow:
    self.text('VERB TIERS',x+7,y+24,6.2,'Head')
    for i,t in enumerate(['I','II','III','IV']):self.check(x+73+i*39,y+22,t,'verb_tier',t in owned['VERB_TIER'],9)
    self.text('DOMAINS',x+7,y+45,6.2,'Head')
    domain=' / '.join(r['ref']+' '+access_option(r) for r in rows if r['category']=='DOMAIN')
    if c or source_rows is not None:self.text(domain or 'None recorded',x+73,y+44,9,'Body')
    else:self.write(x+73,y+41,w-83,16,'domains')
    self.text('RANGE',x+7,y+66,6.2,'Head')
    for i,t in enumerate(RANGES):self.check(x+7+i*(w-12)/6,y+79,t,'range',t in owned['RANGE'],7.8,DISTANCES[i])
    self.text('DICE',x+7,y+109,6.2,'Head')
    for i,t in enumerate(DICE):self.check(x+43+i*40,y+107,t,'output_die',t in owned['INTENSITY_DICE'],8.2)
    if not c and source_rows is None:self.text('Dots = owned pieces / scope follows each rule',x+7,y+126,6.5,'Body',g=.25)
   else:
    self.text('TIERS',x+6,y+25,6.3,'Head')
    for i,t in enumerate(['I','II','III','IV']):self.check(x+43+i*35,y+23,t,'verb_tier',t in owned['VERB_TIER'],9)
    self.text('DOMAINS',x+217,y+25,6.3,'Head')
    domain=' / '.join(r['ref']+' '+access_option(r) for r in rows if r['category']=='DOMAIN')
    if c or source_rows is not None:self.text(domain or 'None recorded',x+278,y+24,9,'Body')
    else:self.write(x+278,y+20,w-284,18,'domains')
    self.text('RANGE',x+6,y+48,6.3,'Head')
    for i,t in enumerate(RANGES):self.check(x+49+i*44,y+44,t,'range',t in owned['RANGE'],7.5,DISTANCES[i])
    self.text('DIE',x+327,y+48,6.3,'Head')
    for i,t in enumerate(DICE):self.check(x+353+(i%4)*34,y+44+(i//4)*12,t,'output_die',t in owned['INTENSITY_DICE'],7.5)
  for r in rows:
   if r['category'] in ACCESS:self.placed.append({'page':self.page,**r,'area':'owned_access','display_value':access_option(r)})
  if c or source_rows is not None:
   refs=' / '.join(r['ref']+' '+access_option(r) for r in rows if r['category'] in ACCESS and r['category']!='DOMAIN')
   self.plain(refs,x+7,y+(321 if vertical else 123 if w<400 else 66),w-14,6.6,8.0)

 def scaling(self,y,workbench=False,compact=False):
  self.band('AT THE TABLE / DECLARE YOUR SCALE',L,y,R-L,True)
  self.text('Diamonds = intent, not purchases. Agree access, CV, Strain and Cost.',L+8,y+22,7.5,'Body')
  self.text('DICE COUNT',R-111,y+23,6.0,'Head');self.write(R-47,y+18,40,14,'dice_count')
  if compact:
   for i,(label,values) in enumerate(AXES):
    yy=y+36+i*12
    self.rect(L+5,yy-1,83,10,.92);self.text(label.upper(),L+9,yy+1,6.0,'Head')
    xx=L+96
    for val in values:xx+=self.check(xx,yy,val,'intent_'+label.lower().replace(' ','_'),False,8.2,meaning='intent')
   self.line(L,y+108,R,y+108,.45,.5)
   return
  for i,(label,values) in enumerate(AXES):
   col=i%2;row=i//2;x=L+col*(CW+GAP);yy=y+34+row*33
   # Filled, shaped category caps echo the page's structural header ribs.
   self.rect(x+7,yy-1,CW-14,10,.92)
   self.text(label.upper(),x+11,yy+1,6.4,'Head')
   xx=x+10;cy=yy+14
   for val in values:
    need=11+pdfmetrics.stringWidth(val,'Body',8.2)+7
    if xx+need>x+CW-3:xx=x+10;cy+=11
    xx+=self.check(xx,cy,val,'intent_'+label.lower().replace(' ','_'),False,8.2,meaning='intent')
  self.line(L,y+137,R,y+137,.45,.5)
  if workbench:
   self.text('Use owned reach / die; respect the individual rule. Choice alone grants no access.',L+8,y+151,8.0,'Body')

 def ledger(self,x,y,w,bottom,c=None,rows=None,dense=False):
  self.band('PRIMITIVES / REUSABLE EFFECTS',x,y,w,True)
  if not dense:self.text('Name + mechanical rule / narrative fallback',x+8,y+23,7.2,'Body',g=.25)
  start=y+(27 if dense else 40)
  if c is not None or rows is not None:
   pending=[r for r in (rows if rows is not None else v6.records(c)) if r['category'] not in ACCESS]
   columns=2 if dense else 1;colw=(w-(GAP if dense else 0))/columns
   col=0;yy=start
   for i,r in enumerate(pending):
    html=f'<b>{escape(r["ref"]+" / "+v6.clean(r["name"]))}</b> · {escape(v6.clean(r["rule"]))}'
    size,leading=(8.8,10.4) if dense else (9.3,11.2)
    ht=self.paragraph(html,x,yy,colw-9,size,leading,False)+2
    if yy+ht>bottom:
     col+=1;yy=start
    if col>=columns:return pending[i:]
    xx=x+col*(colw+GAP)
    self.paragraph(html,xx+4,yy,colw-9,size,leading)
    self.line(xx+3,yy+ht-1,xx+colw-4,yy+ht-1,.72,.3)
    self.placed.append({'page':self.page,**r,'area':'primitive_rules'});yy+=ht
   return []
  columns=2 if dense else 1;colw=(w-(GAP if dense else 0))/columns
  lead=10.8 if dense else 13.4
  for col in range(columns):
   xx=x+col*(colw+GAP)
   for j in range(int((bottom-start)/lead)):
    yy=start+j*lead
    self.write(xx+17,yy,colw-22,lead,'flowing_primitive_rule')
   self.text('REF',xx+1,start-9,5.7,'Head',g=.35)
   self.line(xx+13,start-3,xx+13,bottom,.72,.35)
  if dense:
   if self.key=='vesper':
    self.curve(x+w/2,y+20,x+w/2-5,y+75,x+w/2+5,bottom-25,x+w/2,bottom,g=.63,w=.4)
   else:
    self.poly([(x+w/2,y+20),(x+w/2+3,y+30),(x+w/2+3,bottom-10),(x+w/2,bottom)],g=.6,w=.4,close=False)
  return []

 def state_rail(self,y,c=None):
  self.text('ONGOING / DEFENCES / ENDING',L,y,6.2,'Head')
  if c:
   msg='Flight needs forward motion; no hover. Glide 30 ft sideways per 10 ft down. Survey sight +5 only for named measurement, no shot bonus.' if c['name']==v6.ASTER['name'] else 'Survey tool +5 only for named task (Fieldcraft +21 then). Held passage DC +2 (20) while braced; ends on moving/lowering shield.'
   self.plain(msg,L+174,y-2,R-L-174,7.8,9.4)
  else:self.write(L+174,y-3,R-L-174,16,'ongoing_endings')

 def footer_state(self,c=None):
  y=798;self.text('REACTION',L,y+1,5.8,'Head');self.check(L+50,y-1,'','reaction',False,meaning='intent')
  self.text('SLOTS used / max',L+75,y+1,5.8,'Head');self.write(L+156,y-4,43,15,'slots_used')
  self.text('/ '+str(c['encumbrance']['equipSlotsAvailable']) if c else '/ ___',L+202,y,8.4,'Body')
  self.text('LOAD / capacity',L+249,y+1,5.8,'Head');self.write(L+329,y-4,43,15,'load_current')
  self.text('/ '+str(c['carryCapacity']) if c else '/ ___',L+376,y,8.4,'Body')
  self.text('FOLIO',R-69,y+1,5.8,'Head');self.write(R-37,y-4,37,15,'rule_folio')

 def front(self,density='normal',c=None,rows=None):
  dense=density=='compact'
  self.begin('front / '+density,('COMPACT' if dense else 'NORMAL')+' / CHARACTER INSTRUMENT'+(' / EXAMPLE' if c else ''),c['name'] if c else None)
  self.identity(c)
  self.inner_structure(not dense)
  if dense:
   self.vital_bar(131,c)
   w=(R-L-2*GAP)/3
   for i in range(3):
    yy=183 if self.key=='vesper' or i==1 else 186
    self.compact_attribute(i,L+i*(w+GAP),yy,w,c)
   self.text('Practice hex: empty untrained / dot proficient / filled expertise.',L+4,258,6.4,'Body',g=.25)
   self.access(L,271,R-L,c,source_rows=rows)
   remaining=self.ledger(L,350,R-L,661,c,rows,True)
   self.state_rail(668,c)
  elif self.key=='vesper':
   w=159
   for i,yy in enumerate([139,238,349]):self.attribute(i,L,yy,w,105 if i==1 else 94,c)
   self.live_column(L,454,w,c)
   self.text('Practice hex:',L+9,433,6.1,'Body',g=.25)
   self.text('empty / dot proficient / filled expert',L+9,443,6.1,'Body',g=.25)
   self.access(216,139,R-216,c,source_rows=rows)
   remaining=self.ledger(216,278,R-216,637,c,rows,False)
   self.text('ONGOING / ENDING',L+2,643,6.3,'Head');self.write(L+105,639,R-L-105,14,'ongoing_endings')
  else:
   self.vital_bar(131,c)
   w=(R-L-2*GAP)/3
   for i in range(3):self.attribute(i,L+i*(w+GAP),183 if i==1 else 194,w,101 if i==1 else 90,c)
   self.text('Practice hex: empty untrained / dot proficient / filled expertise.',L+5,290,6.4,'Body',g=.25)
   self.access(L,305,159,c,True,rows)
   remaining=self.ledger(216,305,R-216,637,c,rows,False)
   self.text('ONGOING / ENDING',L+2,643,6.3,'Head');self.write(L+105,639,R-L-105,14,'ongoing_endings')
  self.scaling(688 if dense else 658,compact=dense)
  # The footer fields sit on their own rail, below optional scale examples.
  self.footer_state(c);self.end()
  while remaining:
   self.begin('primitive continuation','PRIMITIVES / CONTINUED',c['name'] if c else 'DENSITY PROOF')
   self.page_heading('Owned rules, continued',c['name'] if c else 'Copied source / pagination test')
   before=len(remaining);remaining=self.ledger(L,137,R-L,790,rows=remaining,dense=True);assert len(remaining)<before
   self.end()

 def page_heading(self,title,character=None):
  self.text(title,L,84,23,'Display')
  if character:self.text(character,L,113,9.0,'Body')
  else:
   self.text('CHARACTER',L,115,6.6,'Head');self.write(L+69,108,220,18,'character')
   self.text('FOLIO / DATE',L+321,115,6.6,'Head');self.write(L+396,108,R-L-396,18,'folio_date')

 def catalogue(self):
  self.begin('blank catalogue','LOADOUT / CONNECTIONS')
  self.page_heading('Compositions & carried things')
  self.band('CAPABILITIES / REMEMBERED COMPOSITIONS',L,141,R-L)
  self.text('Ref / name / ingredients / actual outcome / Cost / limits / ending',L+8,165,8.1,'Body')
  for col in range(2):
   x=L+col*(CW+GAP)
   for i in range(10):
    y=185+i*26
    self.jewel(x+5,y+9,3)
    self.text(str(col*10+i+1).zfill(2),x+1,y-1,5.4,'Head',g=.3)
    self.write(x+18,y-1,CW-24,25,'capability_record')
   # The index spine has physical joins, as a continuation of the frame.
   self.line(x+13,183,x+13,444,.57,.45)
  self.band('EQUIPMENT / ITEM ACCOUNT',L,458,R-L)
  headers=[('EQ',0),('ITEM / NOTES',20),('QTY',283),('LOAD',319),('SLOTS',363),('ITEM BU',410),('STATE',473)]
  self.rect(L,480,R-L,15,.92)
  for label,dx in headers:self.text(label,L+dx+3,484,6.4,'Head')
  for i in range(16):
   y=500+i*13.4;self.jewel(L+7,y+5,2.6)
   self.line(L+2,y+12,R-2,y+12,.7,.35)
   for dx in [18,279,315,358,404,467]:self.line(L+dx,y-1,L+dx,y+12,.73,.3)
   self.writing.append({'page':self.page,'role':'item_name','box':[L+22,y,L+274,y+11]})
  self.text('Slots used / max ____ / ____    Load / capacity ____ / ____    separate Item BU ____',L+4,722,8.5,'Body')
  self.band('CONCEPT / HERITAGES / TIES',L,742,R-L,True)
  self.write(L+6,763,R-L-12,17,'identity_notes')
  self.text('Character BU spent / free ____ / ____     Agreed bonus ____     Mirror credit / debt ____ / ____',L+4,790,8.1,'Body')
  self.end()

 def workbench(self):
  self.begin('blank workbench','IN PLAY / COMPOSE / ACQUIRE')
  self.page_heading('The working surface')
  self.scaling(138,True)
  self.text('REACH',L+8,313,6.4,'Head')
  for i,t in enumerate(RANGES):self.check(L+53+i*44,310,t,'chosen_range',False,7.7,meaning='intent')
  self.text('DIE',L+329,313,6.4,'Head')
  for i,t in enumerate(DICE):self.check(L+354+(i%4)*34,310+(i//4)*12,t,'chosen_die',False,7.5,meaning='intent')
  self.band('AD-HOC COMPOSITIONS / REUSE OWNED PIECES',L,335,R-L)
  for col in range(2):
   for row in range(3):
    x=L+col*(CW+GAP);y=367+row*91
    self.molding(x,y,CW,83,1)
    self.text(str(col*3+row+1).zfill(2),x+9,y+8,8,'Head')
    self.text('INTENT / NAME',x+29,y+8,6.3,'Head');self.write(x+107,y+2,CW-121,18,'composition_name')
    self.text('Refs / outcome',x+10,y+28,7.0,'Body');self.write(x+86,y+23,CW-100,17,'ingredient_outcome')
    self.text('CV / Strain / Cost',x+10,y+47,7.0,'Body');self.write(x+103,y+42,CW-117,17,'complexity_cost')
    self.text('Upkeep / ending',x+10,y+66,7.0,'Body');self.write(x+99,y+61,CW-113,17,'upkeep_ending')
  self.band('NEW PRIMITIVES / PURCHASED DURING PLAY',L,650,R-L)
  self.text('Ref / name + actual rule                                        BU / source / agreement',L+8,675,7.7,'Body')
  for i in range(5):
   y=692+i*17.5;self.jewel(L+8,y+7,3);self.write(L+22,y,R-L-27,17.5,'midgame_primitive')
  self.text('BU before ____   spent ____   left ____     Update main record ____     Table agreement __________________',L+4,789,8.1,'Body')
  self.end()

 def continuation(self):
  self.begin('blank continuation','FULL RULES / REPEATABLE FOLIO')
  self.page_heading('The extended record')
  self.band('PRIMITIVES / EFFECTS / CAPABILITIES / ITEM RULES',L,141,R-L)
  self.text('Ref + name + rule + limits + ending. Use as many lines as the actual rule needs.',L+8,165,8.6,'Body')
  for col in range(2):
   x=L+col*(CW+GAP)
   self.molding(x,184,CW,605,1)
   self.rect(x+8,192,CW-16,14,.92);self.text('REF',x+10,196,6.5,'Head')
   self.text('NAME / RULE / LIMITS',x+38,196,6.5,'Head')
   self.line(x+30,209,x+30,780,.65,.35)
   for y in range(211,780,13):self.line(x+8,y,x+CW-9,y,.68,.35)
   self.writing.append({'page':self.page,'role':'flowing_rule_continuation','box':[x+36,210,x+CW-12,778]})
  self.text('A reference reuses an owned ingredient; it does not purchase it again. Number and repeat this folio.',L+4,797,8.0,'Body')
  self.end()

 def filled_reference(self,c):
  pending=[(name,body) for name,body in self.reference_records(c) if str(body).strip()];index=0
  while index<len(pending):
   self.begin('full source reference','RULES / EFFECTS / ITEMS / STORY',c['name'])
   self.page_heading('The full character record',c['name'])
   self.band('AUTHORED RULES / LIMITS / PERSONAL RECORD',L,137,R-L,True)
   before=index
   used=[]
   for col in range(2):
    y=168;x=L+col*(CW+GAP)
    while index<len(pending):
     name,body=pending[index]
     html=f'<b>{escape(v6.clean(name))}</b><br/>{escape(v6.clean(body)).replace(chr(10),"<br/>")}'
     ht=self.paragraph(html,x,y,CW-4,9.3,11.2,False)+5
     if y+ht>795:break
     self.paragraph(html,x+2,y,CW-4,9.3,11.2);self.line(x,y+ht-2,x+CW,y+ht-2,.73,.3);y+=ht;index+=1
    used.append(y)
   assert index>before,'Split an overlong source record explicitly.'
   # Turn the final reference leaf's genuine remainder into usable play notes.
   if index==len(pending):
    for col,yy in enumerate(used):
     if 795-yy<110:continue
     x=L+col*(CW+GAP);start=yy+19
     self.band('SESSION NOTES / CHANGES / ENDINGS',x,start,CW,True)
     for line in range(int((790-start-31)/13)):
      self.write(x+5,start+29+line*13,CW-10,13,'session_notes')
   self.end()

 def save(self):
  self.c.save();r=PdfReader(self.raw);w=PdfWriter();w.clone_document_from_reader(r)
  for name in ('aubrey','syne','unicaone'):
   p=ROOT/f'docs/publications/quick-core/font-notices/{name}-OFL.txt';w.add_attachment(p.name,p.read_bytes())
  p=ROOT/'docs/publications/character-sheets-v2/oxanium-OFL.txt';w.add_attachment(p.name,p.read_bytes())
  w.add_metadata({'/Title':f'SwordWeave / {self.name} / integrated normal + compact',
   '/Author':'SwordWeave','/Subject':'Local print-and-pencil design review / owned access and declared scale'})
  with self.path.open('wb') as f:w.write(f)
  result={'key':self.key,'name':self.name,'path':str(self.path),'sha256':hashlib.sha256(self.path.read_bytes()).hexdigest(),
   'pages':len(r.pages),'roles':self.roles,'text_boxes':self.texts,'writing_fields':self.writing,'practice_marks':self.marks,
   'rule_placements':self.placed,'art_placements':self.art,'choices':self.choices,'numeric_values':self.numeric,
   'art_master':{'path':str(self.master),'sha256':hashlib.sha256(self.master.read_bytes()).hexdigest()}}
  print(self.path.name,len(r.pages),'pages',flush=True);return result

def main():
 designs=[]
 for key,num,c in [('vesper','01',v6.ASTER),('aegis','02',v6.ORREN)]:
  f=Instrument(key,num);f.front();f.front('compact');f.catalogue();f.workbench();f.continuation();f.front('compact',c);f.filled_reference(c);designs.append(f.save())
 (OUT/'manifest.json').write_text(json.dumps({'designs':designs,'source_snapshots':[v6.OSOURCE,v6.ASOURCE],
  'rules_sources':['src/lib/capabilities/table-guidance.ts','src/lib/rules/play-guide.ts'],
  'intent_axes':AXES,'range_options':RANGES,'dice_options':DICE},indent=2)+'\n')
 # Duplicate original source records solely to measure pagination. Never
 # present this as a legal higher-level character or invent shorter rules.
 pool=v6.records(v6.ORREN)+v6.records(v6.ASTER);rows=[]
 for i in range(80):
  r=dict(pool[i%len(pool)]);r['ref']=f'S{i+1:02}';rows.append(r)
 f=Instrument('aegis','proof',OUT/'density-proof.pdf');f.front('compact',rows=rows[:49]);split=f.page
 f.front('compact',rows=rows);d=f.save()
 (OUT/'density-proof.json').write_text(json.dumps({'pdf':d['path'],'sha256':d['sha256'],'49_records_pages':split,
  '80_records_pages':f.page-split,'placements':d['rule_placements'],'not_a_playable_character':True},indent=2)+'\n')

if __name__=='__main__':main()
