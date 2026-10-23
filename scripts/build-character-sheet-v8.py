#!/usr/bin/env python3
"""Aegis: one connected frame and a complete, repeatable character folio."""
from pathlib import Path
from xml.sax.saxutils import escape
import importlib.util,json,hashlib,re,math
from reportlab.pdfgen import canvas
from pypdf import PdfReader,PdfWriter

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('v7_helpers',ROOT/'scripts/build-character-sheet-v7.py')
v7=importlib.util.module_from_spec(spec);spec.loader.exec_module(v7)
W,H,L,R,GAP,CW=v7.W,v7.H,v7.L,v7.R,v7.GAP,v7.CW
OUT=ROOT/'output/publications/character-sheets-v8';TMP=ROOT/'tmp/pdfs/character-sheets-v8'
for p in (OUT,TMP):p.mkdir(parents=True,exist_ok=True)

class Aegis(v7.Instrument):
 def __init__(self,path=None):
  super().__init__('aegis','01',path or ROOT/'output/pdf/swordweave-character-sheet-v8-aegis-complete.pdf')
  self.raw=TMP/self.path.name
  self.c=canvas.Canvas(str(self.raw),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Body')
  self.frame_paths=[];self.source_blocks=[]

 def full_frame(self):
  # A single closed architectural body joins all four corners. Engraved
  # raster pieces are surface details on that body, not disconnected stickers.
  outer=[(14,25),(25,14),(W-25,14),(W-14,25),(W-14,H-25),(W-25,H-14),(25,H-14),(14,H-25)]
  self.poly(outer,g=.28,w=.85)
  self.poly([(17,30),(29,17),(W-29,17),(W-17,30),(W-17,H-30),(W-29,H-17),(29,H-17),(17,H-30)],g=.62,w=.35)
  self.frame_paths.append({'page':self.page,'kind':'closed_outer_body','points':outer})
  for x in (17,W-28):
   self.poly([(x,53),(x+11,53),(x+11,H-47),(x+6,H-40),(x,H-47)],fill=.94,g=.4,w=.45)
   self.line(x+3,58,x+3,H-48,.4,.45);self.line(x+8,58,x+8,H-48,.65,.3)
  # Joined stepped shoulders span the entire top. The central crest sits in
  # that structure; every shoulder terminates in a physical pilaster.
  half=[(25,29),(70,29),(90,40),(150,40),(177,27),(W/2,27),
        (W/2,35),(179,35),(152,48),(88,48),(68,37),(25,37)]
  self.poly(half,fill=.91,g=.38,w=.55)
  self.poly([(W-x,y) for x,y in half],fill=.91,g=.38,w=.55)
  for side in (-1,1):
   for k in range(7):
    xx=(105+k*9) if side==-1 else W-(105+k*9)
    self.line(xx,41,xx+side*5,46,.57,.28)
  # Full-width bottom sill and returns connect the columns and central jewel.
  bottom=[(25,H-36),(103,H-36),(116,H-29),(W-116,H-29),(W-103,H-36),(W-25,H-36),
          (W-25,H-28),(W-101,H-28),(W-114,H-21),(114,H-21),(101,H-28),(25,H-28)]
  self.poly(bottom,fill=.92,g=.35,w=.6)
  self.line(116,H-25,W-116,H-25,.55,.35)
  self.frame_paths.extend([{'page':self.page,'kind':'top_left_shoulder','points':half},
    {'page':self.page,'kind':'bottom_sill','points':bottom}])
  # Native-pixel crops remain >=300 ppi in both axes. No resampling or
  # enlargement of the source is counted as new engraving detail.
  self.frame_piece((0,0,220,350),(14,14,47,74.77))
  self.frame_piece((804,0,220,350),(W-61,14,47,74.77))
  self.frame_piece((0,0,1024,400),(W/2-80,14,160,62.5))
  for j in range(3):
   for src,x in [((0,330,180,1045),14),((844,330,180,1045),W-33)]:
    self.frame_piece(src,(x,79+j*235,19,235))
  for x in (14,W-33):
   for y in (79,314,549,784):
    self.poly([(x,y-4),(x+5,y-7),(x+14,y-7),(x+19,y-2),(x+19,y+4),(x+14,y+7),(x+5,y+7),(x,y+2)],fill=.95,g=.38,w=.4)
    self.line(x+4,y-3,x+15,y-3,.5,.3);self.line(x+4,y+3,x+15,y+3,.65,.3)
  self.frame_piece((0,1300,180,236),(14,H-59,19,32.78))
  self.frame_piece((844,1300,180,236),(W-33,H-59,19,32.78))
  self.frame_piece((315,1375,395,161),(W/2-39,H-46,78,31.8))

 def begin(self,role,subtitle,character=None):
  self.page+=1;self.roles.append({'page':self.page,'role':role,'character':character})
  self.full_frame()
  self.text('S W O R D W E A V E',L+30,78,8.9,'Label')
  self.text('AEGIS',R-30,78,8.2,'Head',align='right')
  subtitle=subtitle.replace('NORMAL / CHARACTER INSTRUMENT','SPACIOUS / CHARACTER FRONT').replace('COMPACT / CHARACTER INSTRUMENT','DENSE / CHARACTER FRONT')
  self.text(subtitle,R-30,91,6.8,'Head',align='right')
  self.poly([(L+6,H-26),(L+103,H-26),(L+107,H-20),(L+103,H-15),(L+6,H-15)],fill=1,g=.7,w=.25)
  self.poly([(R-23,H-26),(R-3,H-26),(R,H-21),(R-3,H-15),(R-23,H-15)],fill=1,g=.7,w=.25)
  self.text('v0.1 ALPHA / PRINT + PENCIL',L+9,H-23,5.8,'Label',g=.25)
  self.text(str(self.page).zfill(2),R-7,H-23,6.8,'Head',align='right')
  self.c.bookmarkPage('page-'+str(self.page));self.c.addOutlineEntry(subtitle,'page-'+str(self.page),0,False)

 def identity(self,c=None):
  self.text('NAME',L,90,6.1,'Head')
  if c:self.text(c['name'],L,99,18,'Display')
  else:self.write(L,97,325,20,'name')
  self.text('LEVEL / BUDGET',388,102,6.1,'Head')
  if c:
   b=c['buBalance'];self.text(f"{c['level']} / {b['progressionSpent']} of {b['progressionPool']} BU / {b['progressionRemaining']} free",388,113,8,'Head')
  else:self.write(388,111,R-388,18,'level_budget')
  self.text('CONCEPT / HERITAGES',L,121,6.1,'Head')
  if c:self.text(' / '.join(h['heritage']['name'] for h in c['heritageLinks']),150,120,9.1,'Body')
  else:self.write(150,116,213,14,'concept_heritages')

 def vital_bar(self,y,c=None):super().vital_bar(y+3,c)

 def page_heading(self,title,character=None):
  self.text(title,L,105,21,'Display')
  if character:self.text(character,L,132,9,'Body')
  else:
   self.text('CHARACTER',L,134,6.2,'Head');self.write(L+65,126,231,18,'character')
   self.text('FOLIO / DATE',L+321,134,6.2,'Head');self.write(L+397,126,R-L-397,18,'folio_date')

 def front(self,density='normal',c=None,rows=None):
  # Preserve the accepted arrangements; content, rather than level, chooses
  # the broad one-column or dense two-column primitive field.
  super().front(density,c,rows)
  self.roles[-1]['density_name']='spacious' if density=='normal' else 'dense'

 def paragraph_record(self,name,body,x,y,w,size=9.4,lead=11.5,draw=True):
  html=f'<b>{escape(v7.v6.clean(name))}</b><br/>{escape(v7.v6.clean(body)).replace(chr(10),"<br/>")}'
  return self.paragraph(html,x,y,w,size,lead,draw)

 def content_records(self,c,kind):
  allrows=self.reference_records(c)
  if kind=='capabilities':
   item_owners={cap['capability']['name']:f'I{i:02} / '+ln['item']['name'] for i,ln in enumerate(c['itemLinks'],1) for cap in ln['item'].get('capabilityLinks',[])}
   character_caps={ln['capability']['name'] for ln in c['capabilityLinks']}
   return [(n+(' · '+('character + ' if n.split(' / ',1)[1] in character_caps else '')+item_owners[n.split(' / ',1)[1]] if n.split(' / ',1)[1] in item_owners else ''),b) for n,b in allrows if re.match(r'C\d\d / ',n)]
  if kind=='effects':return [(n,b) for n,b in allrows if re.match(r'E\d\d / ',n)]
  if kind=='items':return [(n,b) for n,b in allrows if re.match(r'I\d\d / ',n)]
  if kind=='primitives':return [(n,b) for n,b in allrows if re.match(r'P\d\d / ',n)]
  return []

 def flow_source(self,rows,top,bottom,cw=CW,gap=GAP,size=9.4,leading=11.5):
  index=0;self.last_flow_ends=[]
  heights=[self.paragraph_record(n,b,L,top,cw-4,size,leading,False)+5 for n,b in rows]
  split=None
  if heights and sum(heights)<=2*(bottom-top):
   candidates=[k for k in range(1,len(rows)+1) if sum(heights[:k])<=bottom-top and sum(heights[k:])<=bottom-top]
   if candidates:split=min(candidates,key=lambda k:abs(sum(heights[:k])-sum(heights[k:])))
  for col in range(2):
   x=L+col*(cw+gap);y=top
   while index<len(rows):
    if col==0 and split is not None and index>=split:break
    n,b=rows[index];h=self.paragraph_record(n,b,x,y,cw-4,size,leading,False)+5
    if y+h>bottom:break
    self.paragraph_record(n,b,x+2,y,cw-4,size,leading)
    self.line(x,y+h-2,x+cw,y+h-2,.7,.3)
    self.source_blocks.append({'page':self.page,'name':n,'body':b,'box':[x,y,x+cw,y+h]})
    index+=1;y+=h
   self.last_flow_ends.append(y)
  return rows[index:]

 def capabilities(self,c=None):
  self.begin('filled capabilities' if c else 'blank capabilities','CAPABILITIES / REUSABLE EFFECTS',c['name'] if c else None)
  self.page_heading('Compositions & reusable effects',c['name'] if c else None)
  if c:
   caps=self.content_records(c,'capabilities');effects=self.content_records(c,'effects')
   self.band('CAPABILITIES / CHARACTER AND ITEM SOURCES',L,157,R-L)
   assert not self.flow_source(caps,185,474,size=9.3,leading=11.2),'Capabilities need a continuation.'
   self.band('EFFECTS / STATE / LIMITS / HOW THEY END',L,486,R-L)
   assert not self.flow_source(effects,514,791,size=9.3,leading=11.2),'Effects need a continuation.'
   last=max(self.last_flow_ends)
   if 791-last>62:
    self.text('SCENE CHANGES / LIMITS / ENDINGS',L+6,last+18,6.3,'Head')
    for yy in range(int(last+31),779,14):self.write(L+5,yy,R-L-10,14,'effect_scene_notes')
  else:
   self.band('CAPABILITIES / REMEMBERED COMPOSITIONS',L,157,R-L)
   self.text('Name / owned refs / actual outcome / Cost / limits / ending',L+8,181,8.2,'Body')
   for col in range(2):
    x=L+col*(CW+GAP)
    for i in range(10):
     y=201+i*29
     self.text(f'C{col*10+i+1:02}',x+1,y+1,6.5,'Head',g=.3)
     self.write(x+26,y,CW-31,26,'capability_record')
    self.line(x+22,200,x+22,490,.6,.4)
   self.band('REUSABLE EFFECTS / ACTUAL CHANGE / ENDING',L,508,R-L)
   self.text('An effect can be reused in other compositions. Reference the same owned ingredients.',L+8,532,8.0,'Body')
   for col in range(2):
    x=L+col*(CW+GAP)
    for i in range(6):
     y=553+i*38
     self.text(f'E{col*6+i+1:02}',x+1,y+1,6.5,'Head',g=.3)
     self.write(x+26,y,CW-31,34,'effect_record')
    self.line(x+22,551,x+22,780,.6,.4)
  self.end()

 def equipment(self,c=None):
  self.begin('filled equipment' if c else 'blank equipment','EQUIPMENT / LOAD / ITEM RULES',c['name'] if c else None)
  self.page_heading('Carried & equipped',c['name'] if c else None)
  self.band('EQUIPMENT / QUANTITY / LOAD / EQUIPPED SLOTS',L,157,R-L)
  self.text('Character BU and Item BU are separate. Record actual quantities and item-only rules.',L+8,181,8.1,'Body')
  starts=[0,21,273,310,353,398,453];ends=[18,269,306,349,394,449,R-L]
  labels=['EQ','ITEM / REF','QTY','LOAD','SLOTS','ITEM BU','STATE']
  self.rect(L,199,R-L,16,.92)
  for dx,label in zip(starts,labels):self.text(label,L+dx+3,204,6.3,'Head')
  count=len(c['itemLinks']) if c else 24;rowh=18 if c else 13.4
  for i in range(count):
   y=220+i*rowh
   for dx in starts[1:]:self.line(L+dx-2,y-2,L+dx-2,y+rowh-2,.7,.3)
   self.line(L,y+rowh-2,R,y+rowh-2,.65,.35)
   self.check(L+4,y+3,'','equipped',bool(c and c['itemLinks'][i]['equipped']))
   if c:
    link=c['itemLinks'][i];it=link['item'];load={'TINY':1,'SMALL':1,'MEDIUM':2,'LARGE':4,'HUGE':8,'GARGANTUAN':16}[it['size']]*link['quantity']
    vals=[f'I{i+1:02} / '+it['name'],str(link['quantity']),str(load),str(it['slotCost'] if link['equipped'] else 0),str(it['buCost']*link['quantity']),'equipped' if link['equipped'] else 'carried']
    for j,val in enumerate(vals,1):self.text(val,L+starts[j]+3,y+3,9.0 if j==1 else 8.1,'Body')
    self.source_blocks.append({'page':self.page,'name':f'I{i+1:02} / '+it['name'],'table_values':vals,'quantity':link['quantity'],'load':load,'equipped_slots':it['slotCost'] if link['equipped'] else 0,'item_bu':it['buCost']*link['quantity']})
   else:
    for j in range(1,7):self.writing.append({'page':self.page,'role':'item_'+labels[j].lower().replace(' / ','_').replace(' ','_'),'box':[L+starts[j]+3,y,L+ends[j]-2,y+rowh-3]})
  totaly=220+count*rowh+10
  self.text('SLOTS used / max',L+4,totaly,6.4,'Head');self.write(L+99,totaly-5,45,17,'slots_current')
  self.text('/ '+str(c['encumbrance']['equipSlotsAvailable']) if c else '/ ___',L+148,totaly-1,9,'Body')
  self.text('LOAD / capacity',L+206,totaly,6.4,'Head');self.write(L+296,totaly-5,46,17,'load_current')
  self.text('/ '+str(c['carryCapacity']) if c else '/ ___',L+347,totaly-1,9,'Body')
  self.text('ITEM BU',R-84,totaly,6.4,'Head')
  if c:self.text(str(c['buBalance']['itemBuSpent']),R-20,totaly-1,9,'Head')
  else:self.write(R-35,totaly-5,32,17,'item_bu_total')
  if c:
   self.band('ITEM RULES / EACH RULE STAYS WITH ITS SOURCE',L,totaly+30,R-L)
   assert not self.flow_source(self.content_records(c,'items'),totaly+59,791,size=9.3,leading=11.2),'Item rules need a continuation.'
   last=max(self.last_flow_ends)
   if 791-last>100:
    self.band('CONSUMABLES / REPAIRS / TEMPORARY ITEM STATE',L,last+20,R-L,True)
    for yy in range(int(last+48),779,14):self.write(L+5,yy,R-L-10,14,'item_scene_notes')
  else:
   self.band('ITEM RULES / SOURCE / LIMITS / ENDING',L,579,R-L)
   for col in range(2):
    x=L+col*(CW+GAP);self.molding(x,609,CW,112,1)
    self.text('ITEM / REF',x+10,620,6.3,'Head');self.write(x+75,614,CW-90,18,'item_reference')
    for yy in (641,655,669,683,697):self.write(x+10,yy,CW-23,13,'item_rule')
   self.band('RESOURCES / QUANTITIES / NOTES',L,738,R-L,True)
   for yy in (762,778):self.write(L+7,yy,R-L-14,14,'resource_notes')
  self.end()

 def workbench(self):
  self.begin('blank workbench','IN PLAY / COMPOSE / ACQUIRE')
  self.page_heading('The working surface')
  self.scaling(157,compact=True)
  self.text('REACH',L+8,278,6.2,'Head')
  for i,t in enumerate(v7.RANGES):self.check(L+52+i*44,275,t,'chosen_range',False,7.7,meaning='intent')
  self.text('DIE',L+329,278,6.2,'Head')
  for i,t in enumerate(v7.DICE):self.check(L+354+(i%4)*34,275+(i//4)*12,t,'chosen_die',False,7.5,meaning='intent')
  self.band('NEW COMPOSITIONS / REUSE OWNED INGREDIENTS',L,305,R-L)
  for col in range(2):
   for row in range(2):
    x=L+col*(CW+GAP);y=335+row*135;self.molding(x,y,CW,125,1)
    self.text(f'{col*2+row+1:02}',x+9,y+9,8,'Head');self.text('INTENT / NAME',x+30,y+9,6.2,'Head')
    self.write(x+111,y+3,CW-125,18,'composition_name')
    self.text('Owned refs',x+10,y+31,7.3,'Body');self.write(x+77,y+25,CW-91,18,'ingredient_refs')
    self.text('OUTCOME / SCOPE / RESOLUTION',x+10,y+49,6.0,'Head')
    self.write(x+10,y+57,CW-23,13,'scope_resolution');self.write(x+10,y+70,CW-23,13,'scope_resolution')
    self.text('CV / Strain / Cost',x+10,y+89,6.8,'Body');self.write(x+107,y+84,CW-121,17,'complexity_cost')
    self.text('Upkeep / ending',x+10,y+109,6.8,'Body');self.write(x+104,y+103,CW-118,17,'upkeep_ending')
  self.band('NEW PRIMITIVES / AGREED DURING PLAY',L,614,R-L)
  self.rect(L,638,R-L,13,.92)
  self.text('REF / NAME + ACTUAL RULE',L+6,641,6.4,'Head');self.text('BU / SOURCE / AGREEMENT',R-149,641,6.4,'Head')
  for i in range(6):
   yy=656+i*18;self.jewel(L+7,yy+7,3);self.write(L+22,yy,R-L-27,18,'midgame_primitive')
  self.text('BU before',L+5,779,7,'Body');self.write(L+62,773,40,18,'bu_before')
  self.text('Spent',L+121,779,7,'Body');self.write(L+156,773,40,18,'bu_spent')
  self.text('Left',L+215,779,7,'Body');self.write(L+239,773,40,18,'bu_remaining')
  self.text('Update main record',L+304,779,7,'Body');self.check(L+410,778,'','main_record_updated',False,meaning='intent')
  self.end()

 def continuation(self):
  self.begin('blank continuation','FULL RULES / REPEATABLE FOLIO')
  self.page_heading('The extended record')
  self.band('PRIMITIVES / EFFECTS / CAPABILITIES / ITEM RULES',L,157,R-L)
  self.text('Ref + name + actual rule + limits + ending. Continue for as many lines as needed.',L+8,181,8.2,'Body')
  self.text('OWNER / SOURCE',L+7,201,6.2,'Head')
  for i,t in enumerate(['Character','Item','Other']):self.check(L+104+i*84,198,t,'rule_owner',False,8.5,meaning='intent')
  for col in range(2):
   x=L+col*(CW+GAP);self.molding(x,224,CW,557,1)
   self.rect(x+7,232,CW-15,14,.92);self.text('REF',x+10,236,6.1,'Head');self.text('NAME / RULE / LIMITS / ENDING',x+38,236,6.1,'Head')
   self.line(x+30,250,x+30,771,.65,.35)
   for yy in range(251,773,13):self.line(x+7,yy,x+CW-9,yy,.67,.35)
   self.writing.append({'page':self.page,'role':'flowing_rule_continuation','box':[x+36,250,x+CW-12,771]})
  self.text('References reuse owned ingredients. Item-only permissions stay with their item.',L+6,795,8.1,'Body')
  self.end()

 def identity_page(self,c=None):
  self.begin('filled identity' if c else 'blank identity','CONCEPT / STORY / ADVANCEMENT',c['name'] if c else None)
  self.page_heading('The person & the becoming',c['name'] if c else None)
  self.band('CONCEPT / MANIFEST / HERITAGES / UPBRINGINGS',L,157,R-L)
  self.text('Use the combinations that describe this character; these are not fixed slots.',L+8,181,8.0,'Body')
  if c:
   yy=201
   for link in c['heritageLinks']:
    h=link['heritage'];height=self.paragraph_record('Heritage / '+h['name'],h['description'],L+4,yy,R-L-8,9.4,11.5)+8
    self.source_blocks.append({'page':self.page,'name':'Heritage / '+h['name'],'body':h['description']});yy+=height
   self.band('ORIGIN / MOTIVATION / TIES / PERSONAL FLAW',L,yy+5,R-L)
   yy+=35
   for title,body in c['backstory'].items():
    if not str(body).strip():continue
    height=self.paragraph_record(title.title(),body,L+4,yy,R-L-8,9.4,11.5)+8
    self.source_blocks.append({'page':self.page,'name':title,'body':body});yy+=height
   self.band('BUILD ACCOUNT / DISTINCT FROM EXECUTION COST',L,yy+10,R-L)
   b=c['buBalance'];copy=f"Level / Budget {c['level']} / {b['progressionPool']} BU. Character BU spent {b['progressionSpent']}; {b['progressionRemaining']} available. Separate Item BU {b['itemBuSpent']}. No mirror credit recorded. The personal flaw grants no BU."
   self.plain(copy,L+5,yy+38,R-L-10,9.5,11.5)
   for line in range(int((790-yy-89)/14)):self.write(L+5,yy+81+line*14,R-L-10,14,'personal_notes')
  else:
   self.write(L+5,200,R-L-10,18,'concept_heritages');self.write(L+5,221,R-L-10,18,'concept_heritages')
   self.molding(L,257,155,178,1)
   self.text('PORTRAIT / SIGIL / PERSONAL MARK',L+9,270,6.1,'Head')
   self.writing.append({'page':self.page,'role':'portrait_sketch','box':[L+10,288,L+145,423]})
   self.band('ORIGIN / MOTIVATION / TIES',L+174,257,R-L-174,True)
   for yy in range(285,431,14):self.write(L+179,yy,R-L-184,14,'backstory')
   self.band('DRAWBACKS / CONSEQUENCES / HOW THEY END',L,456,R-L)
   self.text('State the actual rule and any agreed credit. A personal flaw alone grants no automatic BU.',L+8,480,8.0,'Body')
   for yy in (501,517,533,549):self.write(L+5,yy,R-L-10,15,'drawback_rule_ending')
   self.band('BUILD ACCOUNT / ADVANCEMENT',L,583,R-L)
   labels=[('Level / Budget',L+7,139),('Character BU spent / free',L+178,157),('Separate Item BU',L+373,139)]
   for label,x,width in labels:self.text(label,x,610,6.2,'Head');self.write(x,622,width,19,'budget_account')
   self.text('Agreed bonus ____     Mirror credit / debt ____ / ____     Source / agreement ______________________',L+7,654,8.1,'Body')
   self.rect(L,678,R-L,14,.92)
   for label,x in [('DATE',L+6),('BU / CHANGE',L+73),('ACQUISITION / REF / AGREEMENT',L+181)]:self.text(label,x,682,6.4,'Head')
   for i in range(5):self.write(L+5,699+i*17,R-L-10,17,'advancement_record')
  self.end()

 def full_primitive_rules(self,c):
  pending=self.content_records(c,'primitives')
  while pending:
   self.begin('full primitive reference','PRIMITIVES / FULL AUTHORED RULES',c['name'])
   self.page_heading('The owned rules, in full',c['name'])
   self.band('ACTUAL SCOPE / LIMITS / CONDITIONS / ENDING',L,157,R-L)
   before=len(pending);pending=self.flow_source(pending,186,793,size=9.4,leading=11.5);assert len(pending)<before
   if not pending and 793-max(self.last_flow_ends)>110:
    last=max(self.last_flow_ends);self.band('RULE NOTES / AGREED CHANGES / SOURCE',L,last+20,R-L,True)
    for yy in range(int(last+48),779,14):self.write(L+5,yy,R-L-10,14,'full_rule_notes')
   self.end()

 def save(self):
  d=super().save();d['frame_paths']=self.frame_paths;d['source_blocks']=self.source_blocks
  return d

def main():
 f=Aegis();f.front();f.front('compact');f.capabilities();f.equipment();f.workbench();f.continuation();f.identity_page()
 c=v7.v6.ORREN;f.front('compact',c);f.capabilities(c);f.equipment(c);f.identity_page(c);f.full_primitive_rules(c)
 d=f.save()
 # The title belongs to this entire set, not merely a reskinned v7 front.
 r=PdfReader(d['path']);w=PdfWriter();w.clone_document_from_reader(r);w.add_metadata({'/Title':'SwordWeave / Aegis / complete character folio / v8','/Subject':'Local review / two front densities and the complete supporting set'})
 with Path(d['path']).open('wb') as stream:w.write(stream)
 d['sha256']=hashlib.sha256(Path(d['path']).read_bytes()).hexdigest()
 (OUT/'manifest.json').write_text(json.dumps({'designs':[d],'source_snapshots':[v7.v6.OSOURCE],
  'source_character':'Orren Vaultwright','rules_sources':['src/lib/capabilities/table-guidance.ts','src/lib/rules/play-guide.ts'],
  'selected_front_baseline':'v7 Aegis first and second pages; refine without replacing arrangements',
  'future_style_target':'approximately 12 coordinated full-sheet styles after full-folio review'},indent=2)+'\n')

if __name__=='__main__':main()
