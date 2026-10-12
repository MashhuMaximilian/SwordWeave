"""Illustrated book page families; fixed trim, native-resolution art, vector maps.

RGB digital-print interiors, not printer-specific PDF/X or wraparound covers.
"""
from pathlib import Path
import json, math, html
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle, Spacer, KeepTogether
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ART={a['key']:a for a in json.loads((ROOT/'docs/publications/expanded/art-manifest.json').read_text())['assets']}
MAPS={
 'sluice':{'title':'The jammed sluice','caption':'Plan schematic. Route labels give measured distances; room footprints and line lengths are not to scale. Water and blocked trajectories still matter.','rooms':[(50,120,'A','Western landing'),(165,120,'B','Wheel platform'),(90,260,'C','Maintenance passage'),(285,260,'D','Spawning bed')], 'routes':[(50,120,165,120,'30 ft'),(165,120,285,120,'30 ft to east bank'),(50,120,90,260,'40 ft lower route')], 'notes':['A  Rope anchor, boards, tools','B  Snapped timber; visible control','C  Wet passage; access underneath','D  Guardians protect the reeds']},
 'bellhouse':{'title':'The bellhouse of borrowed names','caption':'Plan schematic. Read the distances on routes, not the drawing scale. The lift rises 30 ft; doors and stone walls can obstruct projected paths.','rooms':[(60,255,'E','Lower landing'),(70,110,'F','Archive'),(275,110,'G','Bell gallery'),(275,250,'H','Counterweights')], 'routes':[(60,255,275,110,'50 ft stair route'),(70,110,275,110,'Archive door'),(275,110,275,250,'40 ft corridor')], 'notes':['E  Lift: 30 ft above lower landing','F  Charter, ledger, keeper testimony','G  Three bells; visible hammer arms','H  Old weight, spare, repair tools']}
}
MAPS['sluice']['routeTexts']=['A, western landing, to B, wheel platform: 30 ft.','B, wheel platform, to the east bank: 30 ft.','A, western landing, to C, maintenance passage: 40 ft lower route.']
MAPS['bellhouse']['routeTexts']=['E, lower landing, to G, bell gallery: 50 ft stair route.','F, archive, to G, bell gallery: through the archive door; no distance specified.','G, bell gallery, to H, counterweights: 40 ft corridor.']

WORKSHEETS={
 'character':('Your character at a glance',[('Person and purpose','Who are you? What do you want?'),('Party connection','Why cooperate? Who matters to you?'),('Foundation','Level / progression BU / Physical / Mental / Magical'),('Training and resolution','Proficient attribute / PB / practices / saves / selected DC'),('Survival','Current and maximum Vitality / short-rest recovery remaining'),('Position and movement','Size / modes and speeds / senses / equipped slots / Load')]),
 'acquisitions':('Acquisitions and references',[('Actual acquisition','Name / version / bound subject / BU / occurrence identity'),('Other acquisitions','Record each purchase once; references do not repurchase'),('Organizations','Lineage / Upbringing / Manifest / effects / capabilities'),('Accounting','Positive acquired BU / credit available / debt used / unspent'),('Equipment','Separate Item BU / quantity / Load / final equipped slots')]),
 'capability':('Write a working people can use',[('Intent and permission','Result / verb / domain / range / actual ingredients'),('Recipients and delivery','Location method / paths / shape / conditions'),('Expression','Output / source and domain / resolution / timing'),('Persistence','Duration / continuation / interruption / ending'),('Review','Normal use / stretched use / outside-scope use'),('Ledger','Acquisitions versus references / price proposal / version')]),
 'consequences':('Consequences and continuing work',[('Cause and subject','What happened? Who or what is affected?'),('Actual change','Number / restriction / resource / environment / obligation'),('Timing and maintenance','When does it apply or recur? What is required?'),('Ending and recovery','Duration / task / treatment / explicit ending event'),('Other records','What remains when this one ends? Who tracks it?')]),
 'round':('One shared round',[('Council','Scene / continuation / reactions / Main Intents'),('Fast: Complexity 0–1','Intent / position / clashes / reactions / result'),('Measured: Complexity 2–3','Dependencies / changed route / result'),('Heavy: Complexity 4+','Further dependencies / pivots / result'),('Carry forward','Movement used / Vitality / consequences / ongoing work')]),
 'session':('Return to the shared story',[('Last result','What changed? What remains unresolved?'),('Current record','Vitality / recovery allowance / gear / acquisitions'),('Continuing requirements','Consequences / maintenance / obligations / endings'),('Next purpose','What do you want to pursue? What do others need?'),('Agreement','Rewards / rule revisions / permissions / absent players')]),
 'encounter':('Prepare an encounter',[('Situation','Opening / objective / visible pressure / alternatives'),('Party','Manual Party BU / Party Item BU / size / optional references'),('Opposition','Base BU / Item BU / quantity / version / roles / tactics'),('Place','Routes / distances / cover / senses / resources / warnings'),('Appraisal','Separate totals / ratio / count / concentration; no difficulty label'),('Aftermath','Retreat / resolution / rescue / changed relationships')]),
 'creature':('Build an opponent',[('Purpose','Want / behavior / tell / nonviolent ending'),('Foundation','Base B / rank / points / allocation / PB / Vitality'),('Acquisitions','Actual permissions / modifiers / price / remaining BU'),('Rules','Senses / movement / attacks / saves / source and domain'),('Persistence and gear','Continuation / endings / reactions / separate Item BU'),('Test','Favorable scene / counter-approach / changed environment')]),
 'adventure':('Prepare a situation, not a script',[('Premise','People / place / pressure / useful player choices'),('Facts','What exists? What is wrong? What changes unattended?'),('People','Desire / resource / constraint / credible offers'),('Information','Essential facts / several sources / optional discoveries'),('Locations','Routes / barriers / distances / resources / threats'),('Outcomes','Several resolutions / consequences / next questions')]),
 'ruling':('Make the agreement understandable',[('Wanted result','Ordinary circumstances / extraordinary access'),('Actual scope','Targets / sense / reach / output / persistence'),('Uncertainty','Secure result / check / attack / save / timing / contest'),('Stakes','Success / failure / Cost / timing / options to revise'),('Record','Changed scene / consequence terms / exception scope')])}

def art_flow(key,cw,styles,dark):
 a=ART[key];source=ROOT/a['printMaster'];im=Image.open(source)
 # Never invent resolution by upscaling; all art stays >=300 effective ppi.
 w=min(cw,im.width/300*72,216 if a['transparent'] else cw)
 h=w*im.height/im.width
 if h>260:w*=260/h;h=260
 return KeepTogether([Artwork(source,w,h,dark,a['transparent']),Spacer(1,7),Paragraph(html.escape(a['caption']),styles['small'])])

class Artwork(Flowable):
 def __init__(self,path,w,h,dark,transparent):super().__init__();self.path=path;self.width=w;self.height=h;self.hAlign='CENTER';self.dark=dark;self.transparent=transparent
 def draw(self):
  self.canv.drawImage(ImageReader(str(self.path)),0,0,self.width,self.height,mask='auto',preserveAspectRatio=True)

class Diagram(Flowable):
 """Print diagrams use a vertical reading path with 10+ pt type at trim size."""
 def __init__(self,key,figure,cw,styles,dark):
  super().__init__();self.key=key;self.f=figure;self.width=cw;self.dark=dark;self.styles=styles;self.height=275 if key=='composition' else 37+len(figure['nodes'])*58
 def draw(self):
  c=self.canv;ink=colors.HexColor('#edf4ec' if self.dark else '#142e31');line=colors.HexColor('#b7d2c7' if self.dark else '#668685');panel=colors.HexColor('#19363b' if self.dark else '#f4f7ef')
  c.setFillColor(ink);c.setFont('Display',18);c.drawString(0,self.height-19,self.f['title'])
  if self.key=='composition':
   boxes=[(0,176,118,54,'Heritages','History and expression'),(130,176,118,54,'Capabilities','Complete workings'),(260,176,118,54,'Items','Equipment rules'),(130,97,118,54,'Effects','Grouped ingredients'),(0,14,248,54,'Character acquisitions','Owned primitives: counted once'),(260,14,118,54,'Item acquisitions','Separate Item BU')]
   c.setStrokeColor(line);c.setLineWidth(.7)
   for x,y,x2,y2 in [(59,176,59,68),(189,176,189,151),(189,97,189,68),(319,176,319,68),(130,203,118,203)]:c.line(x,y,x2,y2)
   for x,y,w,h,title,sub in boxes:
    c.setFillColor(panel);c.setStrokeColor(line);c.roundRect(x,y,w,h,3,fill=1,stroke=1);c.setFillColor(ink)
    pp=Paragraph(html.escape(title),ParagraphStyle('diagram-name',fontName='Bold',fontSize=10,leading=12,textColor=ink,alignment=1));_,ph=pp.wrap(w-10,h);pp.drawOn(c,x+5,y+h-8-ph)
    pp=Paragraph(html.escape(sub),ParagraphStyle('diagram-sub',fontName='Body',fontSize=10.5,leading=12,textColor=ink,alignment=1));_,ph=pp.wrap(w-10,h);pp.drawOn(c,x+5,y+7)
   return
  for i,(_,_,_,_,title,sub) in enumerate(self.f['nodes']):
   y=self.height-34-(i+1)*58;c.setFillColor(panel);c.setStrokeColor(line);c.setLineWidth(.6);c.roundRect(0,y,self.width,49,3,fill=1,stroke=1)
   c.setFillColor(colors.HexColor('#f3db9d' if self.dark else '#684711'));c.setFont('Bold',10);c.drawString(10,y+31,title)
   c.setFillColor(ink);c.setFont('Body',11.5);c.drawString(10,y+12,' / '.join(sub).replace('→','to').replace('–','-').replace('×','x'))
   if self.key not in ('budgets','composition') and i<len(self.f['nodes'])-1:
    c.setStrokeColor(line);c.line(self.width/2,y,self.width/2,y-9)
  if self.key=='composition':
   # The adjacent caption, not sequence numbering, explains reference nesting.
   c.setFont('Technical',7.7);c.setFillColor(line)

class Map(Flowable):
 def __init__(self,key,cw,dark):super().__init__();self.key=key;self.width=cw;self.height=425*cw/360;self.dark=dark
 def draw(self):
  c=self.canv;m=MAPS[self.key];p={'ink':'#f0f2e9' if self.dark else '#142e31','panel':'#19363b' if self.dark else '#f1f5ec','teal':'#9bcfc3' if self.dark else '#24696a','gold':'#f3db9d' if self.dark else '#684711'};c.saveState();c.scale(self.width/360,self.width/360)
  c.setFillColor(colors.HexColor(p['panel']));c.roundRect(0,0,360,425,4,fill=1,stroke=0)
  c.setFont('Display',20);c.setFillColor(colors.HexColor(p['ink']));c.drawString(14,397,m['title'])
  if self.key=='sluice':
   c.setFillColor(colors.HexColor('#235b65' if self.dark else '#d3e8e6'));c.rect(190,118,53,260,fill=1,stroke=0);c.setFont('Body',11);c.setFillColor(colors.HexColor(p['teal']));c.drawString(198,148,'Water')
  for x,y,x2,y2,label in m['routes']:
   yy=390-y;yy2=390-y2;c.setStrokeColor(colors.HexColor(p['teal']));c.setLineWidth(1.5);c.line(x,yy,x2,yy2)
   pp=Paragraph(html.escape(label),ParagraphStyle('map-route',fontName='Body',fontSize=11,leading=12,textColor=colors.HexColor(p['ink']),backColor=colors.HexColor(p['panel']),alignment=1));pp.wrap(108,60);pp.drawOn(c,(x+x2)/2-54,(yy+yy2)/2+8)
  for x,y,letter,name in m['rooms']:
   yy=390-y;c.setFillColor(colors.HexColor(p['panel']));c.setStrokeColor(colors.HexColor(p['gold']));c.circle(x,yy,17,fill=1,stroke=1);c.setFillColor(colors.HexColor(p['gold']));c.setFont('Bold',14);c.drawCentredString(x,yy-5,letter)
   pp=Paragraph(html.escape(name),ParagraphStyle('map-label',fontName='Body',fontSize=12,leading=13,textColor=colors.HexColor(p['ink']),backColor=colors.HexColor(p['panel']),alignment=1));_,h=pp.wrap(100,40);pp.drawOn(c,max(5,min(255,x-50)),yy-22-h)
  c.setFillColor(colors.HexColor(p['ink']));c.setFont('Body',11)
  for i,note in enumerate(m['notes']):c.drawString(14,76-i*16,note)
  c.restoreState()

def map_svg(key,dark):
 m=MAPS[key];ink='#f0f2e9' if dark else '#142e31';panel='#19363b' if dark else '#f1f5ec';teal='#9bcfc3' if dark else '#24696a';gold='#f3db9d' if dark else '#684711'
 parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 425" role="img"><title>{html.escape(m["title"])}</title><desc>{html.escape(m["caption"])}</desc><rect width="360" height="425" rx="4" fill="{panel}"/><text x="14" y="28" fill="{ink}" font-family="Aubrey,serif" font-size="18">{html.escape(m["title"])}</text>']
 if key=='sluice':parts.append(f'<rect x="190" y="37" width="53" height="260" fill="{teal}" opacity=".16"/>')
 for x,y,x2,y2,label in m['routes']:
  y+=35;y2+=35;parts.append(f'<path d="M{x},{y} L{x2},{y2}" stroke="{teal}" stroke-width="1.5"/><rect x="{(x+x2)/2-57}" y="{(y+y2)/2-24}" width="114" height="16" fill="{panel}"/><text x="{(x+x2)/2}" y="{(y+y2)/2-12}" text-anchor="middle" font-family="Aubrey,serif" font-size="11" fill="{ink}">{html.escape(label)}</text>')
 for x,y,letter,name in m['rooms']:
  y+=35;parts.append(f'<circle cx="{x}" cy="{y}" r="17" fill="{panel}" stroke="{gold}"/><text x="{x}" y="{y+5}" text-anchor="middle" font-family="Syne,sans-serif" font-size="14" fill="{gold}">{letter}</text><rect x="{max(55,min(305,x))-58}" y="{y+20}" width="116" height="18" fill="{panel}"/><text x="{max(55,min(305,x))}" y="{y+34}" text-anchor="middle" font-family="Aubrey,serif" font-size="12" fill="{ink}">{html.escape(name)}</text>')
 for i,note in enumerate(m['notes']):parts.append(f'<text x="14" y="{349+i*16}" font-family="Aubrey,serif" font-size="11" fill="{ink}">{html.escape(note)}</text>')
 return ''.join(parts)+'</svg>'

class Worksheet(Flowable):
 def __init__(self,key,cw,height,styles,dark):super().__init__();self.key=key;self.width=cw;self.height=height;self.styles=styles;self.dark=dark
 def draw(self):
  c=self.canv;title,fields=WORKSHEETS[self.key];ink=colors.HexColor('#edf4ec' if self.dark else '#142e31');line=colors.HexColor('#819e9b' if self.dark else '#82999e');c.setFillColor(ink)
  pp=Paragraph('Optional table tool. Copy or print for your own game. These fields record agreements; they do not add rules.',self.styles['small']);_,h=pp.wrap(self.width,60);pp.drawOn(c,0,self.height-h)
  y=self.height-54;box=(y-20)/len(fields)
  for label,hint in fields:
   c.setFillColor(ink);c.setFont('Bold',10);c.drawString(0,y-12,label);pp=Paragraph(html.escape(hint),self.styles['small']);_,h=pp.wrap(self.width,40);pp.drawOn(c,0,y-20-h)
   c.setStrokeColor(line);c.setLineWidth(.45)
   for yy in (y-box+8,y-box+22):c.line(0,yy,self.width,yy)
   y-=box
