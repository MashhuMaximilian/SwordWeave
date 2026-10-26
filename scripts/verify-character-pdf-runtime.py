#!/usr/bin/env python3
"""Closed-file preflight for runtime character PDFs, bound to final SHA-256.

Reads actual PDF operators, embedded raster/alpha bytes, fonts and glyphs. The
layout manifest supplies expected source crops and geometry, never substitutes
for the operations in the final PDF. Usage: python ... manifest.json [...].
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re

from PIL import Image
import pdfplumber
from pypdf import PdfReader
from pypdf.generic import ContentStream


def sha(data):
    return hashlib.sha256(data).hexdigest()


def norm(value):
    return re.sub(r'\s+', '', str(value)).replace('\u2013', '-').replace('\u2014', '-').replace('\u2011', '-')


def combine(o, n):
    a,b,c,d,e,f=o; A,B,C,D,E,F=n
    return (a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f)


def point(m, x, y):
    a,b,c,d,e,f=m
    return (a*x+c*y+e,b*x+d*y+f)


def near(a,b,tol=.025):
    return len(a)==len(b) and all(abs(float(x)-float(y))<tol for x,y in zip(a,b))


def verify(manifest):
    m=json.loads(Path(manifest).read_text()); path=Path(m['path'])
    assert sha(path.read_bytes())==m['sha256'], ('changed PDF',path)
    r=PdfReader(path)
    assert len(r.pages)==m['pages']
    required_notices={'Aubrey-OFL.txt','Syne-OFL.txt','Oxanium-OFL.txt','UnicaOne-OFL.txt'}
    assert required_notices.issubset(set(r.attachments)), 'missing embedded font notice'
    if m.get('media_credits'):
        assert 'SwordWeave-image-and-icon-credits.txt' in r.attachments
    assert not r.get_fields()
    full='\n'.join(p.extract_text() for p in r.pages)
    assert not any(bad in full for bad in ('\ufffd','<br/>','$undefined'))
    color_edition=m.get('options',{}).get('color',False)
    assert isinstance(color_edition,bool)
    assert bool(m.get('color_theme'))==color_edition
    sources={}
    for key, asset in m['raster_assets'].items():
        p=Path(asset['path']); assert sha(p.read_bytes())==asset['sha256']
        im=Image.open(p).convert('LA'); g,a=im.split()
        alpha_hash=sha(a.tobytes())
        assert asset.get('embedded_alpha_sha256',alpha_hash)==alpha_hash
        space=asset.get('color_space','DeviceGray')
        assert space==('DeviceRGB' if color_edition else 'DeviceGray')
        pixel_hash=asset['embedded_rgb_sha256'] if color_edition else sha(g.tobytes())
        assert pixel_hash
        sources[key]=(im.size,pixel_hash,alpha_hash,space)
    fonts=set(); min_ppi=float('inf'); images=0; clips=0; curves=0; color_operations=0
    for page_no,page in enumerate(r.pages,1):
        width,height=map(float,(page.mediabox.width,page.mediabox.height))
        assert near((width,height),m['page_size'])
        for ref in page['/Resources']['/Font'].values():
            font=ref.get_object(); fonts.add(str(font['/BaseFont']))
            assert '/ToUnicode' in font
            desc=font['/FontDescriptor'].get_object()
            assert any(k in desc for k in ('/FontFile','/FontFile2','/FontFile3'))
        expected=[a for a in m['art_placements'] if a['page']==page_no]
        media=[a for a in m.get('media_placements',[]) if a['page']==page_no]
        stack=[]; ctm=(1,0,0,1,0,0); active_clips=[]; path_ops=[]; pending_clip=False; found=[]
        for operands,op in ContentStream(page.get_contents(),r).operations:
            v=[float(x) for x in operands] if op in (b'cm',b're',b'm',b'l',b'c',b'rg',b'RG',b'k',b'K') else operands
            if op==b'q': stack.append((ctm,list(active_clips)))
            elif op==b'Q': ctm,active_clips=stack.pop()
            elif op==b'cm': ctm=combine(ctm,v)
            elif op in (b'rg',b'RG'):
                if color_edition: color_operations+=max(v)-min(v)>1e-6
                else: assert max(v)-min(v)<1e-6, 'colour ink in monochrome edition'
            elif op in (b'k',b'K'):
                if not color_edition: assert max(map(abs,v[:3]))<1e-6, 'colour ink in monochrome edition'
            elif op==b're':
                x,y,w,h=v; path_ops.append(('re',*point(ctm,x,y),*point(ctm,x+w,y+h)))
            elif op in (b'm',b'l',b'c'):
                coords=[]
                for i in range(0,len(v),2): coords.extend(point(ctm,*v[i:i+2]))
                path_ops.append((op.decode(),*coords))
            elif op==b'h': path_ops.append(('h',))
            elif op in (b'W',b'W*'): pending_clip=True
            elif op in (b'n',b'S',b's',b'f',b'f*',b'B',b'B*',b'b',b'b*'):
                if pending_clip:
                    active_clips.append(list(path_ops)); clips+=1
                    curves+=any(p[0]=='c' for p in path_ops)
                path_ops=[];pending_clip=False
            elif op==b'Do':
                im=page['/Resources']['/XObject'][operands[0]].get_object()
                assert im['/Subtype']=='/Image', 'unexpected nested form; extend verifier'
                assert str(im['/ColorSpace']) in ('/DeviceGray','/DeviceRGB')
                if not color_edition: assert str(im['/ColorSpace'])=='/DeviceGray'
                found.append((ctm,list(active_clips),im))
        assert len(found)==len(expected)+len(media), (path.name,page_no,'image count',len(found),len(expected)+len(media))
        remaining=list(found)

        def take_image(pixel_hash,alpha_hash,matrix,space):
            for index,(actual_matrix,actual_clips,im) in enumerate(remaining):
                if near(actual_matrix,matrix) and sha(im.get_data())==pixel_hash:
                    assert str(im['/ColorSpace'])=='/'+space, 'different image color space'
                    assert sha(im['/SMask'].get_object().get_data())==alpha_hash, 'different decoded alpha bytes'
                    remaining.pop(index)
                    return actual_matrix,actual_clips,im
            raise AssertionError(('missing exact image transform/bytes',path.name,page_no,matrix))

        for a in expected:
            (iw,ih),pixel_hash,alpha_hash,space=sources[a['asset_key']]
            x,y,w,h=a['box'];sx,sy,sw,sh=a['source']; scale_x=w/sw;scale_y=h/sh
            A=iw*scale_x;D=ih*scale_y; E=x-sx*scale_x;F=height-y+sy*scale_y-ih*scale_y
            if a['mirror']: A=-A; E=2*x+w-E
            if a['flip_y']: D=-D; F=2*(height-y)-h-F
            origin=a['global_box'][0]-x
            matrix,actual_clips,im=take_image(pixel_hash,alpha_hash,(A,0,0,D,E+origin,F),space)
            assert (int(im['/Width']),int(im['/Height']))==(iw,ih)
            want=('re',x+origin,height-y-h,x+origin+w,height-y)
            assert any(any(p[0]=='re' and near(p[1:],want[1:]) for p in clip) for clip in actual_clips), 'missing actual crop clip'
            if a['clip_contour']:
                contour=[]
                for piece in a['clip_contour']:
                    coords=list(piece[1:]);coords=[v+origin if i%2==0 else v for i,v in enumerate(coords)]
                    contour.append((piece[0],*coords))
                assert any(len(clip)==len(contour) and all(p[0]==q[0] and near(p[1:],q[1:]) for p,q in zip(clip,contour)) for clip in actual_clips), 'missing actual native contour'
            ppi=min(iw*72/math.hypot(matrix[0],matrix[1]),ih*72/math.hypot(matrix[2],matrix[3]))
            min_ppi=min(min_ppi,ppi); assert ppi>=299.9, ('native image PPI',ppi)
            images+=1
        for a in media:
            x,y,right,bottom=a['draw_box'];iw,ih=a['native_size']
            space=a.get('color_space','DeviceGray')
            assert space==('DeviceRGB' if color_edition else 'DeviceGray')
            pixel_hash=a['rgb_sha256'] if color_edition else a['gray_sha256']
            matrix,actual_clips,im=take_image(pixel_hash,a['alpha_sha256'],(right-x,0,0,bottom-y,x,height-bottom),space)
            assert (int(im['/Width']),int(im['/Height']))==(iw,ih)
            clip=a.get('clip')
            if clip and clip['kind']=='polygon':
                want=[('m' if i==0 else 'l',px,height-py) for i,(px,py) in enumerate(clip['points'])]+[('h',)]
                assert any(len(c)==len(want) and all(p[0]==q[0] and near(p[1:],q[1:]) for p,q in zip(c,want)) for c in actual_clips), 'missing actual portrait polygon clip'
            elif clip and clip['kind']=='rounded':
                x0,y0,x1,y1=clip['box']
                matched=False
                for c in actual_clips:
                    if not any(p[0]=='c' for p in c): continue
                    xs=[p[i] for p in c for i in range(1,len(p),2)]
                    ys=[p[i] for p in c for i in range(2,len(p),2)]
                    if near((min(xs),min(ys),max(xs),max(ys)),(x0,height-y1,x1,height-y0)):
                        matched=True
                assert matched, 'missing actual rounded portrait clip'
            ppi=min(iw*72/abs(matrix[0]),ih*72/abs(matrix[3]))
            min_ppi=min(min_ppi,ppi);assert ppi>=299.9,('media PPI',a['key'],ppi)
            images+=1
        assert not remaining, 'unverified embedded image'
    if color_edition: assert color_operations>len(r.pages)*10, 'missing native color styling'
    families=' '.join(fonts).replace('-','').lower()
    for face in ('aubrey','syne','unicaone','oxanium'): assert face in families, ('missing app font',face)
    # Verify each painted fragment in its actual page, then reconstruct source
    # records across panel/page labels inserted by continuation headings.
    for segment in m['rule_segments']:
        assert norm(segment.get('rendered_text',segment['text'])) in norm(r.pages[segment['page']-1].extract_text()), ('missing painted fragment',segment['ref'])
    for group in m['source_records'].values():
        for record in group:
            painted=''.join(s.get('rendered_text',s['text']) for s in m['rule_segments'] if s['ref']==record.get('ref') and s['name']==record['name'])
            if record.get('body'): assert norm(record.get('rendered_text',record['body'])) in norm(painted), ('missing full rule',record['name'])
    for record in m['primitive_records']:
        if record.get('rule'): assert norm(record.get('rendered_text',record['rule'])) in norm(full), ('missing primitive',record['ref'])
    for value in m['numeric_values']:
        assert value['value'] in r.pages[value['page']-1].extract_text(), ('missing number',value)
    for pair in m.get('metric_pairs',[]):
        lx,ly,lr,lb=pair['label_box'];vx,vy,vr,vb=pair['value_box']
        cx,cy,cr,cb=pair['card'];sx,sy,sr,sb=pair['cell']
        assert lr+2<=sx and sx<=vx<=vr<=sr, ('label/value separation',pair)
        assert cx+5<=vx and vr<=cr-5 and cy<=vy and vb<=cb, ('number outside card',pair)
    for mark in m.get('roll_annotations',[]):
        practice=mark['target'].split('.')[-1]
        pair=next(p for p in m['metric_pairs'] if p['page']==mark['page'] and p['role']=='practice_'+practice)
        value=next(t for t in m['text_boxes'] if t['page']==pair['page'] and t['box']==pair['value_box'])
        assert abs(mark['baseline']-(value['box'][1]+value['size']*.8))<.01, ('roll marker baseline',mark)
        assert mark['box'][0]>=pair['cell'][2]+2.9 and mark['box'][2]<=pair['card'][2]-4, ('roll marker clearance',mark)
    for box in m['text_boxes']+m['writing_fields']:
        x,y,right,bottom=box['box']
        assert x>=0 and right<=m['page_size'][0]+.03 and y>=0 and bottom<=m['page_size'][1]-.01,(path.name,'bounds',box)
        if m['fold_gutter']:
            left,right_fold=m['fold_gutter']; assert right<=left or x>=right_fold, ('fold collision',box)
    glyphs=0
    with pdfplumber.open(path) as pdf:
        for page_no,page in enumerate(pdf.pages,1):
            for seal in (s for s in m.get('attribute_seals',[]) if s['page']==page_no):
                left,top,right,bottom=seal['value_box']
                chars=[c for c in page.chars if c['x0']>=left-.02 and c['x1']<=right+.02 and abs(c['top']-top)<3]
                expected=next(n['value'] for n in m['numeric_values'] if n['page']==page_no and n['role']==seal['role'])
                assert ''.join(c['text'] for c in chars)==expected, ('missing attribute glyph',seal)
                inner_left,inner_top,inner_right,inner_bottom=seal['inner_box']
                assert all(c['x0']>=inner_left-.02 and c['x1']<=inner_right+.02 and
                           c['top']>=inner_top-.02 and c['bottom']<=inner_bottom+.02 for c in chars), ('attribute touches seal',seal)
            for ch in page.chars:
                assert ch['x0']>=10 and ch['x1']<=page.width-10, ('glyph x bounds',path.name,ch['text'])
                assert ch['top']>=10 and ch['bottom']<=page.height-10, ('glyph y bounds',path.name,ch['text'])
                if m['fold_gutter']:
                    left,right=m['fold_gutter']; assert ch['x1']<=left or ch['x0']>=right, ('actual glyph at fold',ch['text'])
                glyphs+=1
    return {'file':str(path),'sha256':m['sha256'],'pages':len(r.pages),'color_edition':color_edition,'native_color_operations':color_operations,'images':images,'actual_clip_paths':clips,
            'actual_curved_clips':curves,'minimum_native_ppi':round(min_ppi,2),'fonts':sorted(fonts),'glyphs':glyphs,
            'source_rules':'PASS','decoded_image_and_alpha_bytes':'PASS','transforms_and_clips':'PASS','bounds_and_fold':'PASS',
            'inline_roll_markers_and_attribute_clearance':'PASS'}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('manifests',nargs='+');parser.add_argument('--output');args=parser.parse_args()
    reports=[verify(p) for p in args.manifests]
    result={'status':'PASS','files':reports}
    if args.output: Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'status':'PASS','files':len(reports),'pages':sum(r['pages'] for r in reports),'minimum_native_ppi':min(r['minimum_native_ppi'] for r in reports)}))
