#!/usr/bin/env python3
"""Render the four actual front variants for each style, using public Orren.

No private character is ever used for shipped preview images. The generator
uses the same native PDF front methods as export, then rasterizes that front.
"""
import argparse
from io import BytesIO
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import sys

from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_pdf.renderer import RuntimeFolio
from character_pdf.design import STYLES, ROOT


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--snapshot',required=True);parser.add_argument('--color',action='store_true');args=parser.parse_args()
    source=Path(args.snapshot);character=json.loads(source.read_text())
    if character.get('id')!='1da4e351-da76-4822-bf1f-632d2e657145' or character.get('name')!='Orren Vaultwright':
        raise ValueError('Only the approved public Orren snapshot may ship as gallery previews')
    out=ROOT/'public/character-sheet-styles';out.mkdir(parents=True,exist_ok=True)
    entries=[]
    with tempfile.TemporaryDirectory(prefix='sw-sheet-previews-') as directory:
        pdf=Path(directory)/'front.pdf'
        for style,_,_,_ in STYLES:
            for orientation in ('portrait','landscape'):
                for density in ('normal','compact'):
                    options={'style':style,'orientation':orientation,'density':density,'workbench':False,'color':args.color}
                    folio=RuntimeFolio(character,options,pdf)
                    if orientation=='portrait':folio.front_portrait(density)
                    else:folio.front_landscape(density)
                    folio.c.save();pdf.write_bytes(folio.stream.getvalue())
                    png=subprocess.run(['/opt/homebrew/bin/pdftoppm','-f','1','-l','1','-singlefile','-scale-to-x','1188' if orientation=='landscape' else '840','-scale-to-y','-1','-png',str(pdf)],check=True,capture_output=True).stdout
                    image=Image.open(BytesIO(png)).convert('RGB')
                    path=out/f'{style}-{orientation}-{density}{"-color" if args.color else ""}.webp';image.save(path,'WEBP',quality=82,method=5)
                    entries.append({'style':style,'orientation':orientation,'density':density,'color':args.color,'path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':list(image.size),'bytes':path.stat().st_size})
            print(style,flush=True)
    (out/('manifest-color.json' if args.color else 'manifest.json')).write_text(json.dumps({'public_example':'Orren Vaultwright','color':args.color,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'renderer_sha256':hashlib.sha256((ROOT/'scripts/character_pdf/renderer.py').read_bytes()).hexdigest(),'images':entries},indent=2)+'\n')
    print(f'Prepared {len(entries)} previews, {sum(row["bytes"] for row in entries)} bytes')


if __name__=='__main__':main()
