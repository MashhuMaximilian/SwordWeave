"""Validate the exact PDF exports against their manuscript and asset manifest."""
from pathlib import Path
import json,hashlib
import pdfplumber
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'docs/publications/release-manifest.json').read_text())
books={b['slug']:b for b in json.loads((ROOT/'src/lib/publications/books.json').read_text())}
results=[]
for row in manifest['pdfs']:
 path=ROOT/'output/pdf'/row['filename'];data=path.read_bytes();reader=PdfReader(path)
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],path
 assert len(reader.pages)==row['pages']
 expected_anchors={heading['id'] for heading in books[row['slug']]['headings']}
 if row.get('printRevision')==2:expected_anchors|={'contents','publication'}
 assert set(row['anchors'])==expected_anchors,(path,'destinations')
 assert all(0<p<=len(reader.pages) for p in row['anchors'].values())
 bounds=[];ppi=[];embedded=set();missing=[]
 with pdfplumber.open(path) as pdf:
  for i,page in enumerate(pdf.pages):
   expected=[v*72 for v in row.get('trimInches',[6.5,9])]
   assert [page.width,page.height]==expected,(path,i,'trim')
   text=page.extract_text() or ''
   assert text.strip(),(path,i,'empty')
   assert '\ufffd' not in text,(path,i,'replacement glyph')
   out=[c for c in page.chars if c['x0']<20 or c['x1']>page.width-20 or c['top']<10 or c['bottom']>page.height-10]
   if out:bounds.append({'page':i+1,'text':''.join(c['text'] for c in out)})
   for image in page.images:
    pixels=image.get('srcsize')
    if pixels and image['width']>0 and image['height']>0:ppi.append(min(pixels[0]*72/image['width'],pixels[1]*72/image['height']))
  assert not bounds,(path,bounds)
  # Art placement is recorded at its native resolution. The illustrated covers
  # deliberately use the full native image; resampling does not invent detail.
  assert not ppi or min(ppi)>=(140 if row.get('printRevision')==2 else 299.8),(path,min(ppi))
 for page in reader.pages:
  fonts=page.get('/Resources',{}).get('/Font',{}).get_object()
  for fontref in fonts.values():
   font=fontref.get_object();name=str(font.get('/BaseFont',''));desc=font.get('/FontDescriptor')
   if font.get('/Subtype')=='/TrueType':
    assert desc and desc.get_object().get('/FontFile2'),(path,name,'font not embedded')
    embedded.add(name)
 for name in ['UnicaOne','Aubrey','Syne']+([] if row.get('printRevision')==2 else ['IBMPlexMono']):
  assert any(name.lower().replace('-','') in f.lower().replace('-','') for f in embedded),(path,name,embedded)
 results.append({'file':row['filename'],'pages':row['pages'],'words':row['words'],'sha256':row['sha256'],'trimPoints':expected,'fontsEmbedded':sorted(embedded),'minimumImagePpi':round(min(ppi),2) if ppi else None,'boundsFailures':bounds,'anchors':len(row['anchors']),'links':row['links'],'uniqueArt':len(set(a['key'] for a in row.get('artPlacements',[]))),'artPlacements':len(row.get('artPlacements',[]))})
report={'edition':manifest['edition'],'checks':results,'limits':['No physical printer proof or PDF/X certification','No independent human playtest','Damage-triggered additional Vitality upkeep remains pending']}
(ROOT/'output/pdf/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ['file','pages','minimumImagePpi','anchors','links']} for r in results],indent=2))
