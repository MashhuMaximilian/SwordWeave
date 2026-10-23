#!/usr/bin/env python3
"""Prepare unchanged-resolution print assets and the exact app's font outlines."""
from pathlib import Path
import json,hashlib,shutil,math
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/character-pdf'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def prepare_emphasis_fonts():
 """Same-scale Aubrey emphasis, matching the approved book font process."""
 source=OUT/'fonts/Aubrey.ttf';entries=[]
 for name,bold,italic in [('BodyBold',True,False),('BodyItalic',False,True),('BodyBoldItalic',True,True)]:
  original=TTFont(source);font=TTFont(source);glyphs=original.getGlyphSet()
  for glyph_name in original.getGlyphOrder():
   record=DecomposingRecordingPen(glyphs);glyphs[glyph_name].draw(record);pen=TTGlyphPen(None)
   offsets=[(-7,0),(7,0),(0,4)] if bold else [(0,0)]
   shear=math.tan(math.radians(10)) if italic else 0
   for dx,dy in offsets:record.replay(TransformPen(pen,(1,0,shear,1,dx,dy)))
   font['glyf'][glyph_name]=pen.glyph()
  variant='Semibold Oblique' if bold and italic else 'Semibold' if bold else 'Oblique'
  for platform,encoding,language in [(3,1,0x409),(1,0,0)]:
   for nid,value in [(1,'SwordWeave Character Reading'),(2,variant),(4,'SwordWeave Character Reading '+variant),(6,'SWCharacterReading-'+name[4:])]:
    font['name'].setName(value,nid,platform,encoding,language)
  font['OS/2'].usWeightClass=600 if bold else 400
  font['OS/2'].fsSelection=((1<<5) if bold else 0)|((1<<0) if italic else 0)
  font['head'].macStyle=(1 if bold else 0)|(2 if italic else 0)
  font['post'].italicAngle=-10 if italic else 0
  # Outline emphasis never changes text advances, em size or baseline metrics.
  assert font['hmtx'].metrics==original['hmtx'].metrics
  assert font['head'].unitsPerEm==original['head'].unitsPerEm
  destination=OUT/'fonts'/(name+'.ttf');font.save(destination)
  entries.append({'family':name,'source':str(source.relative_to(ROOT)),'source_sha256':sha(source),'path':str(destination.relative_to(ROOT)),'sha256':sha(destination),'notice':'assets/character-pdf/fonts/Aubrey-OFL.txt','derived_matching_scale':True,'bold':bold,'oblique_degrees':10 if italic else 0})
 return entries

def main():
 (OUT/'fonts').mkdir(parents=True,exist_ok=True)
 manifest={'source':'Approved v11 character sheets and the current app local fonts','fonts':[],'styles':[]}
 fonts=[('Aubrey','aubrey-400-latin-e006e0e2.woff2',None,'docs/publications/quick-core/font-notices/aubrey-OFL.txt'),('Syne','syne-600-latin-48dc6652.woff2',600,'docs/publications/quick-core/font-notices/syne-OFL.txt'),('UnicaOne','unica-one-400-latin-f1708315.woff2',None,'docs/publications/quick-core/font-notices/unicaone-OFL.txt'),('Oxanium','oxanium-500-latin-320e2c0e.woff2',500,'docs/publications/character-sheets-v2/oxanium-OFL.txt')]
 for name,filename,weight,notice in fonts:
  source=ROOT/'src/app/fonts'/filename;dest=OUT/'fonts'/(name+'.ttf')
  f=TTFont(source)
  if weight is not None and 'fvar' in f:f=instantiateVariableFont(f,{'wght':weight},inplace=False)
  f.flavor=None;f.save(dest)
  license_path=OUT/'fonts'/(name+'-OFL.txt');shutil.copy2(ROOT/notice,license_path)
  manifest['fonts'].append({'family':name,'source':str(source.relative_to(ROOT)),'source_sha256':sha(source),'weight':weight,'path':str(dest.relative_to(ROOT)),'sha256':sha(dest),'notice':str(license_path.relative_to(ROOT))})
 manifest['fonts'].extend(prepare_emphasis_fonts())
 approved=json.loads((ROOT/'output/publications/character-sheets-v11/manifest.json').read_text())
 for d in approved['designs']:
  folder=OUT/'styles'/d['key'];folder.mkdir(parents=True,exist_ok=True);assets=[]
  for key,source in [('frame',Path(d['art_master']['path'])),('bridge',ROOT/'output/publications/character-sheets-v11/assets'/(d['key']+'-bridge.png'))]:
   im=Image.open(source).convert('RGBA');out=folder/(key+'.png')
   Image.merge('LA',(im.convert('L'),im.getchannel('A'))).save(out,optimize=True)
   compiled=Image.open(out).convert('RGBA')
   assert compiled.convert('L').tobytes()==im.convert('L').tobytes() and compiled.getchannel('A').tobytes()==im.getchannel('A').tobytes()
   assets.append({'kind':key,'source':str(source.relative_to(ROOT)),'source_sha256':sha(source),'path':str(out.relative_to(ROOT)),'sha256':sha(out),'size':list(im.size),'gray_and_alpha_unchanged':True})
  manifest['styles'].append({'id':d['key'],'name':d['name'],'description':d['design_brief'],'assets':assets})
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({'styles':len(manifest['styles']),'fonts':len(manifest['fonts']),'bytes':sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())}))
if __name__=='__main__':main()
