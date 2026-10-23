#!/usr/bin/env python3
"""Accepted Aegis folio: pencil padding, explicit verb tiers and overflow."""
from pathlib import Path
import importlib.util,json,hashlib
from reportlab.pdfgen import canvas
from pypdf import PdfReader,PdfWriter

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('v8_base',ROOT/'scripts/build-character-sheet-v8.py')
v8=importlib.util.module_from_spec(spec);spec.loader.exec_module(v8)
v7=v8.v7;W,H,L,R,GAP,CW=v8.W,v8.H,v8.L,v8.R,v8.GAP,v8.CW
OUT=ROOT/'output/publications/character-sheets-v9';TMP=ROOT/'tmp/pdfs/character-sheets-v9'
for p in (OUT,TMP):p.mkdir(parents=True,exist_ok=True)
TIER_LABELS={'I':'Tier 1','II':'Tier 2','III':'Tier 3','IV':'Tier 4'}

class Aegis(v8.Aegis):
 def __init__(self,path=None):
  super().__init__(path or ROOT/'output/pdf/swordweave-character-sheet-v9-aegis-complete.pdf')
  self.raw=TMP/self.path.name
  self.c=canvas.Canvas(str(self.raw),pagesize=(W,H),pageCompression=1,invariant=1,initialFontName='Body')
  self.padding_cards=[];self.overflow=[]

 def attribute(self,which,x,y,w,h,c=None):
  super().attribute(which,x,y,w,h+4,c)
  self.padding_cards.append({'page':self.page,'density':'spacious','attribute':v7.GROUPS[which][0],
   'box':[x,y,x+w,y+h+4],'minimum_practice_clearance':8})

 def compact_attribute(self,which,x,y,w,c=None):
  name,practices=v7.GROUPS[which];self.molding(x,y,w,76,.975)
  rx=x+23;cy=y+23
  self.ngon(rx,cy,18,8,fill=.91,w=.65);self.ngon(rx,cy,15,8,w=.25)
  if c:self.value(f"{c['conditionContext']['character']['attributes'][name.lower()]:+d}",rx,cy-7,14,'attribute_'+name.lower())
  else:
   self.text('+',rx-10,cy-5,10,'Head',g=.3);self.write(rx-2,cy-8,14,20,'attribute_'+name.lower())
  self.poly([(x+44,y+7),(x+w-10,y+7),(x+w-4,y+14),(x+w-10,y+22),(x+44,y+22)],fill=.17,w=.3)
  self.text(name.upper(),x+49,y+11,7.6,'Head',1);self.text('SAVE',x+49,y+29,6.1,'Head')
  if c:
   saves=[13,2,3] if c['name']==v7.v6.ORREN['name'] else [4,3,18]
   self.value(f'{saves[which]:+d}',x+w-24,y+25,10,'save_'+name.lower())
  else:self.write(x+82,y+24,w-93,15,'save_'+name.lower())
  lookup={p['practice']:p for p in c['practices']} if c else {}
  for j,p in enumerate(practices):
   px=x+13+(j%2)*(w-15)/2;yy=y+44+(j//2)*11.5;pw=(w-15)/2
   row=lookup.get(p);training=min(2,row['pbContribution']//5) if row else 0
   self.practice_mark(px+2,yy+3.5,p,training);self.text(p.title(),px+10,yy,8.1,'Body')
   if row:self.value(f"{row['total']:+d}",px+pw-14,yy-1,8.2,'practice_'+p)
   else:self.write(px+pw-22.5,yy-2,15,12,'practice_'+p)
  self.padding_cards.append({'page':self.page,'density':'dense','attribute':name,
   'box':[x,y,x+w,y+76],'minimum_practice_clearance':8})

 def vital_bar(self,y,c=None):
  y+=3;self.molding(L,y,R-L,43,1)
  widths=[144,117,47,47,R-L-355];x=L+7
  for i,w in enumerate(widths):
   title=['VITALITY','SHORT REST','DC','PB','MOVEMENT / ft'][i];self.text(title,x+2,y+5,6.3,'Head')
   if i in (0,1):
    self.text('MAX' if i==0 else 'CAP',x+2,y+14,5.5,'Label',g=.3)
    self.text('CURRENT' if i==0 else 'LEFT',x+61,y+14,5.5,'Label',g=.3)
    val=(c['vitality']['max'] if i==0 else (c['vitality']['max']+1)//2) if c else None
    if c:self.value(val,x+23,y+24,12,'vitality_max' if i==0 else 'rest_cap')
    else:self.write(x+3,y+22,44,15,'max_vitality' if i==0 else 'recovery_cap')
    self.write(x+61,y+22,w-69,15,'current_vitality' if i==0 else 'recovery_remaining')
   elif i in (2,3):
    if c:self.value('18' if i==2 else '+5',x+w/2-3,y+24,13,title.lower())
    else:self.write(x+3,y+22,w-13,15,title.lower())
   else:
    speed='W 30 / C 15 / S 15'+(' / F 30' if c and c['name']==v7.v6.ASTER['name'] else '') if c else 'W ___ C ___ S ___ F ___'
    self.text(speed,x+2,y+17,7.8,'Body');self.text('USED',x+2,y+29,5.6,'Label',g=.3)
    self.write(x+29,y+26,w-40,12,'movement_used')
   x+=w
   if i<4:self.line(x-4,y+6,x-4,y+37,.65,.35)

 def access(self,x,y,w,c=None,vertical=False,source_rows=None):
  rows=source_rows if source_rows is not None else v7.v6.records(c) if c else []
  owned={cat:{v7.access_option(r) for r in rows if r['category']==cat} for cat in v7.ACCESS}
  self.band('OWNED ACCESS',x,y,w,True)
  if vertical:
   self.molding(x,y+23,w,296,1);self.text('Verbs:',x+12,y+32,8.5,'Body')
   for i,t in enumerate(TIER_LABELS):self.check(x+12+(i%2)*75,y+48+(i//2)*16,TIER_LABELS[t],'verb_tier',t in owned['VERB_TIER'],8.5)
   self.text('DOMAINS',x+12,y+85,6.8,'Head')
   if c or source_rows is not None:self.plain(' / '.join(r['ref']+' '+v7.access_option(r) for r in rows if r['category']=='DOMAIN') or 'None recorded',x+12,y+100,w-24,8.6,10.8)
   else:
    self.write(x+12,y+97,w-24,14,'domains');self.write(x+12,y+112,w-24,14,'domains')
   self.text('RANGE',x+12,y+136,6.8,'Head')
   for i,t in enumerate(v7.RANGES):self.check(x+12+(i%2)*75,y+151+(i//2)*24,t,'range',t in owned['RANGE'],8.0,v7.DISTANCES[i])
   self.text('OUTPUT DIE',x+12,y+225,6.8,'Head')
   for i,t in enumerate(v7.DICE):self.check(x+12+(i%4)*36,y+242+(i//4)*20,t,'output_die',t in owned['INTENSITY_DICE'],8)
   self.plain('Dots record owned pieces. Their authored scope still applies.',x+12,y+286,w-25,7.6,9.1)
  else:
   self.text('Dot = owned piece / scope per rule',x+w-165,y-10,6.1,'Body',g=.25)
   self.text('Verbs:',x+6,y+24,8.4,'Body')
   for i,t in enumerate(TIER_LABELS):self.check(x+53+i*56,y+23,TIER_LABELS[t],'verb_tier',t in owned['VERB_TIER'],8.6)
   self.text('DOMAINS',x+300,y+25,6.3,'Head')
   domain=' / '.join(r['ref']+' '+v7.access_option(r) for r in rows if r['category']=='DOMAIN')
   if c or source_rows is not None:self.text(domain or 'None recorded',x+363,y+24,9,'Body')
   else:self.write(x+363,y+20,w-369,18,'domains')
   self.text('RANGE',x+6,y+48,6.3,'Head')
   for i,t in enumerate(v7.RANGES):self.check(x+49+i*44,y+44,t,'range',t in owned['RANGE'],7.5,v7.DISTANCES[i])
   self.text('DIE',x+327,y+48,6.3,'Head')
   for i,t in enumerate(v7.DICE):self.check(x+353+(i%4)*34,y+44+(i//4)*12,t,'output_die',t in owned['INTENSITY_DICE'],7.5)
  for r in rows:
   if r['category'] in v7.ACCESS:self.placed.append({'page':self.page,**r,'area':'owned_access','display_value':TIER_LABELS.get(v7.access_option(r),v7.access_option(r))})
  if c or source_rows is not None:
   refs=' / '.join(r['ref']+' '+TIER_LABELS.get(v7.access_option(r),v7.access_option(r)) for r in rows if r['category'] in v7.ACCESS and r['category']!='DOMAIN')
   self.plain(refs,x+7,y+(321 if vertical else 66),w-14,6.6,8.0)

 def front(self,density='normal',c=None,rows=None):
  dense=density=='compact';front_page=self.page+1
  self.begin('front / '+density,('COMPACT' if dense else 'NORMAL')+' / CHARACTER INSTRUMENT'+(' / EXAMPLE' if c else ''),c['name'] if c else None)
  self.identity(c);self.inner_structure(not dense);self.vital_bar(131,c);w=(R-L-2*GAP)/3
  if dense:
   for i in range(3):self.compact_attribute(i,L+i*(w+GAP),183 if i==1 else 186,w,c)
   self.text('Practice hex: empty untrained / dot proficient / filled expertise.',L+4,268,6.4,'Body',g=.25)
   self.access(L,282,R-L,c,source_rows=rows)
   remaining=self.ledger(L,361,R-L,665,c,rows,True);self.state_rail(668,c)
  else:
   for i in range(3):self.attribute(i,L+i*(w+GAP),183 if i==1 else 194,w,101 if i==1 else 90,c)
   self.text('Practice hex: empty untrained / dot proficient / filled expertise.',L+5,292,6.4,'Body',g=.25)
   self.access(L,305,159,c,True,rows);remaining=self.ledger(216,305,R-216,637,c,rows,False)
   self.text('ONGOING / ENDING',L+2,643,6.3,'Head');self.write(L+105,639,R-L-105,14,'ongoing_endings')
  self.scaling(688 if dense else 658,compact=dense);self.footer_state(c);self.end()
  self.roles[front_page-1]['density_name']='dense' if dense else 'spacious'
  while remaining:
   before=len(remaining);remaining=self.primitive_overflow(remaining,c)
   assert len(remaining)<before,'An unabridged rule must progress through the overflow folio.'

 def primitive_overflow(self,rows=None,c=None):
  self.begin('primitive overflow' if rows is not None else 'blank primitive overflow','PRIMITIVES / CONTINUED',c['name'] if c else None)
  self.page_heading('More owned ingredients',c['name'] if c else None)
  self.text('Mechanical rule first; narrative when absent. Preserve each rule\'s limits and ending.',L+7,158,8.2,'Body')
  self.text('CONTINUES FROM / REF',L+6,181,6.2,'Head');self.write(L+147,175,75,18,'previous_primitive_ref')
  self.text('NEXT LEAF / REF',L+265,181,6.2,'Head');self.write(L+373,175,141,18,'next_primitive_ref')
  self.text('Keep the same P references across the front and every continuation; reusing a reference adds no BU.',L+7,204,8.0,'Body')
  if rows is not None:
   before=len(self.placed);pending=self.ledger(L,227,R-L,790,rows=rows,dense=True)
   placed=self.placed[before:]
   self.overflow.append({'page':self.page,'first_ref':placed[0]['ref'] if placed else None,'last_ref':placed[-1]['ref'] if placed else None,'records':len(placed)})
  else:
   self.band('PRIMITIVES / REUSABLE EFFECTS / CONTINUED',L,227,R-L)
   for col in range(2):
    x=L+col*(CW+GAP);self.molding(x,260,CW,521,1)
    self.rect(x+7,268,CW-15,14,.92);self.text('REF',x+10,272,6.2,'Head');self.text('NAME + ACTUAL RULE / LIMITS',x+36,272,6.2,'Head')
    self.line(x+30,287,x+30,770,.65,.35)
    for yy in range(288,771,13):self.line(x+7,yy,x+CW-9,yy,.67,.35)
    self.writing.append({'page':self.page,'role':'primitive_overflow_rules','box':[x+36,287,x+CW-12,770]})
   pending=[]
  self.end();return pending

 def save(self):
  d=super().save();d['padding_cards']=self.padding_cards;d['overflow_pages']=self.overflow;return d

def main():
 f=Aegis();f.front();f.front('compact');f.capabilities();f.equipment();f.workbench();f.continuation();f.identity_page();f.primitive_overflow()
 c=v7.v6.ORREN;f.front('compact',c);f.capabilities(c);f.equipment(c);f.identity_page(c);f.full_primitive_rules(c)
 d=f.save();r=PdfReader(d['path']);w=PdfWriter();w.clone_document_from_reader(r)
 w.add_metadata({'/Title':'SwordWeave / Aegis / padded cards and expandable primitive folio / v9','/Subject':'Local print-and-pencil review / complete sheet set'})
 with Path(d['path']).open('wb') as stream:w.write(stream)
 d['sha256']=hashlib.sha256(Path(d['path']).read_bytes()).hexdigest()
 (OUT/'manifest.json').write_text(json.dumps({'designs':[d],'source_snapshots':[v7.v6.OSOURCE],
  'source_character':c['name'],'rules_sources':['src/lib/capabilities/table-guidance.ts','src/lib/rules/play-guide.ts'],
  'approved_direction':'v8 Aegis complete folio; creator loves it; padding/tier labels and high-count behavior refined'},indent=2)+'\n')
 # Layout tests only: retain access once, then repeat actual non-access source
 # records. This models growing rule text more honestly than repeatedly adding
 # extra tiers/ranges/dice to the already-grouped access rail.
 proof=Aegis(OUT/'capacity-proof.pdf');tests=[]
 original=v7.v6.records(c);access=[r for r in original if r['category'] in v7.ACCESS];pool=[r for r in original if r['category'] not in v7.ACCESS]
 for count in (49,80,120):
  rows=[dict(r) for r in access]+[dict(pool[i%len(pool)]) for i in range(count-len(access))]
  for i,row in enumerate(rows):row['ref']=f'S{i+1:03}'
  start=proof.page+1;proof.front('compact',rows=rows)
  tests.append({'count':count,'from_page':start,'to_page':proof.page,'pages':proof.page-start+1})
 pd=proof.save()
 (OUT/'capacity-proof.json').write_text(json.dumps({'pdf':pd['path'],'sha256':pd['sha256'],'tests':tests,
  'placements':pd['rule_placements'],'overflow_pages':pd['overflow_pages'],
  'source_snapshot':v7.v6.OSOURCE,'purpose':'Pagination only; duplicated original rules, not legal character builds'},indent=2)+'\n')

if __name__=='__main__':main()
