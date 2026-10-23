#!/usr/bin/env python3
"""Repair all twelve frames: aligned rail atlas, joined ornamental beams, clean footer."""
from pathlib import Path
import importlib.util,hashlib,json
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader,PdfWriter
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('collection',ROOT/'scripts/build-character-sheet-v10.py')
v10=importlib.util.module_from_spec(s);s.loader.exec_module(v10)
v7=v10.v7;v6=v10.v6
W,H,L,R=v10.W,v10.H,v10.L,v10.R
OUT=ROOT/'output/publications/character-sheets-v11';TMP=ROOT/'tmp/pdfs/character-sheets-v11';PDF=ROOT/'output/pdf/character-sheets-collection-v11'
for p in (OUT,TMP,PDF):p.mkdir(parents=True,exist_ok=True)

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
class Folio(v10.Folio):
 def __init__(self,index,style,path=None):
  super().__init__(index,style,path or PDF/f'swordweave-character-sheet-{index:02}-{style[0]}.pdf')
  self.raw=TMP/self.path.name;self.c=canvas.Canvas(str(self.raw),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Body')
  self.joins=[];self.beams=[]
  self.assets={'original':{'path':self.master,'image':self.art_image,'size':(self.iw,self.ih)}}
  p=OUT/'assets'/(self.key+'-bridge.png')
  assert p.is_file(),f'Missing commissioned bridge: {p}'
  if p.is_file():
   im=Image.open(p).convert('RGBA');self.assets['bridge']={'path':p,'image':ImageReader(Image.merge('LA',(im.convert('L'),im.getchannel('A')))),'size':im.size}

 def asset_piece(self,key,src,dst,mirror=False,shoulder=False,flip_y=False):
  sx,sy,sw,sh=src;x,y,w,h=dst;asset=self.assets[key];iw,ih=asset['size'];c=self.c
  c.saveState();clip=c.beginPath();clip.rect(x,H-y-h,w,h);c.clipPath(clip,stroke=0)
  contour=[]
  if shoulder:
   # The new elbow tapers into the narrow existing post. Its broad raster
   # tail must not end as a rectangular ledge beside the character name.
   local=[('m',0,0),('l',w,0),('l',w,h),('l',135,h),('c',100,h,85,48,65,44),('c',40,39,25,45,19,h),('l',0,h),('h',)]
   q=c.beginPath()
   for op,*values in local:
    vv=[]
    for xx,yy in zip(values[::2],values[1::2]):vv.extend([x+(w-xx if mirror else xx),H-y-yy])
    contour.append([op,*vv])
    if op=='m':q.moveTo(*vv)
    elif op=='l':q.lineTo(*vv)
    elif op=='c':q.curveTo(*vv)
    else:q.close()
   c.clipPath(q,stroke=0)
  if mirror:c.transform(-1,0,0,1,2*x+w,0)
  if flip_y:c.transform(1,0,0,-1,0,2*(H-y)-h)
  xs,ys=w/sw,h/sh
  c.drawImage(asset['image'],x-sx*xs,H-y+sy*ys-ih*ys,width=iw*xs,height=ih*ys,mask='auto');c.restoreState()
  self.art.append({'page':self.page,'source':src,'box':dst,'source_ppi':[72/xs,72/ys],'asset_key':key,'mirror':mirror,'flip_y':flip_y,'clip_contour':contour})

 def full_frame(self):
  # Fine outer keyline encloses the actual joined ornamental structure.
  cut={'aegis':11,'vesper':12,'orrery':8,'moire':16,'serein':20,'prism':23,'cipher':7,'helix':14,'cinder':6,'nocturne':18,'tidal':10,'solstice':15}[self.key]
  pts=[(14,14+cut),(14+cut,14),(W-14-cut,14),(W-14,14+cut),(W-14,H-14-cut),(W-14-cut,H-14),(14+cut,H-14),(14,H-14-cut)]
  self.poly(pts,g=.62,w=.4);self.frame_paths.append({'page':self.page,'kind':'closed_outer_body','points':pts})
  # No pale plates are painted over the rails. Native longitudinal strands
  # connect every repeated section, beneath its unchanged source alpha.
  for x in (14,W-33):
   self.line(x+8,33,x+8,H-27,.53,1.25);self.line(x+12,33,x+12,H-27,.7,.55)
  # Alternating reflected rail cells meet on identical source rows. The
  # lower corner is the reflected upper corner, so it joins the same row too.
  # There are no width jumps or repeated fragments of the old lower flourish.
  strips=[(0,330,False),(330,870,False),(330,870,True),(330,870,False),(330,870,True),(0,330,True)]
  scale=(H-28)/sum(sh for sy,sh,flip in strips)
  heights=[sh*scale for sy,sh,flip in strips]
  for sx,x in ((0,14),(844,W-33)):
   y=14
   for (sy,sh,flip),hh in zip(strips,heights):
    self.asset_piece('original',(sx,sy,180,sh),(x,y,19,hh),flip_y=flip);y+=hh
   assert abs(y-(H-14))<1e-6
   self.joins.append({'page':self.page,'side':'left' if sx==0 else 'right','rail_box':[x,14,x+19,H-14],'uniform_scale':[19/180,scale],'seam_y':[14+sum(heights[:i]) for i in range(1,len(heights))],'source_rows_match':True})
  # Each commissioned half already contains its own connected centre.
  # Reflect at its measured crest axis: never paste a cropped whole-frame crown.
  axes={'aegis':2100,'vesper':2045,'orrery':1966,'moire':2003,'serein':1957,'prism':1874,'cipher':2122,'helix':1991,'cinder':2072,'nocturne':1987,'tidal':2083,'solstice':2145}
  iw,ih=self.assets['bridge']['size'];left=iw*.0276;src=(left,0,axes[self.key]-left,ih)
  half=W/2-14
  for mirror,x in ((False,14),(True,W/2)):
   self.asset_piece('bridge',src,(x,14,half,60),mirror,shoulder=True)
   self.asset_piece('bridge',src,(x,H-30,half,16),mirror)
  self.beams.extend([{'page':self.page,'kind':'joined_top','box':[14,14,W-14,74]}, {'page':self.page,'kind':'joined_base','box':[14,H-30,W-14,H-14]}])

 def begin(self,role,subtitle,character=None):
  self.page+=1;self.roles.append({'page':self.page,'role':role,'character':character});self.full_frame()
  self.text('S W O R D W E A V E',L+30,78,8.9,'Label');self.text('v0.1 ALPHA',172,80,5.5,'Label',g=.3)
  self.text(self.name.upper()+' / '+str(self.page).zfill(2),R-30,78,8.2,'Head',align='right')
  a,b=('SPACIOUS','DENSE') if self.key=='aegis' else ('NORMAL','COMPACT')
  subtitle=subtitle.replace('NORMAL / CHARACTER INSTRUMENT',a+' / CHARACTER FRONT').replace('COMPACT / CHARACTER INSTRUMENT',b+' / CHARACTER FRONT')
  self.text(subtitle,R-30,91,6.8,'Head',align='right')
  # Edition and page number live in the header; the ornamental base stays clear.
  self.c.bookmarkPage('page-'+str(self.page));self.c.addOutlineEntry(subtitle,'page-'+str(self.page),0,False)

 def save(self):
  d=super().save();d.update({'frame_joins':self.joins,'frame_beams':self.beams,'frame_revision':'v11 / matched reflected side rows / continuous crown and base / no white connector masks'})
  d['raster_assets']={k:{'path':str(a['path']),'sha256':sha(a['path'])} for k,a in self.assets.items()}
  r=PdfReader(d['path']);w=PdfWriter();w.clone_document_from_reader(r);w.add_metadata({'/Title':f'SwordWeave / {self.name} / connected-frame character folio / v11','/Subject':'Complete normal and compact folio / repaired crown, rails and base'})
  with Path(d['path']).open('wb') as stream:w.write(stream)
  d['sha256']=sha(d['path']);return d

def build(index,style):
 f=Folio(index,style);f.front();f.front('compact');f.capabilities();f.equipment();f.workbench();f.continuation();f.identity_page();f.primitive_overflow()
 c=v6.ORREN;f.front('compact',c);f.capabilities(c);f.equipment(c);f.identity_page(c);f.full_primitive_rules(c)
 return f.save()

def main():
 ds=[build(i,s) for i,s in enumerate(v10.STYLES,1)]
 (OUT/'manifest.json').write_text(json.dumps({'designs':ds,'source_snapshots':[v6.OSOURCE],'rules_sources':['src/lib/capabilities/table-guidance.ts','src/lib/rules/play-guide.ts'],'previous_edition':str(v10.OUT/'manifest.json'),'scope':'Repair the outer frame across all pages; retain the v10 content and interior styles.'},indent=2)+'\n')
if __name__=='__main__':main()
