"""Build contact sheets for inspection, without modifying the generated assets."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'docs/ritual-source-image-manifest.json').read_text())
for start in range(0,50,10):
 sheet=Image.new('RGB',(1500,720),'#f2eee6');draw=ImageDraw.Draw(sheet)
 for pos,item in enumerate(manifest[start:start+10]):
  x=(pos%5)*300;y=(pos//5)*360
  file=root/'public'/item['target'].lstrip('/')
  label=f'{item["number"]:02d} {item["id"].split("/")[1]}'
  draw.text((x+8,y+8),label[:42],fill='#372d25')
  if file.exists():
   im=Image.open(file).convert('RGBA');im.thumbnail((280,315));sheet.paste(im,(x+(300-im.width)//2,y+35+(315-im.height)//2),im)
  else:draw.text((x+20,y+120),'NOT GENERATED',fill='#854a36')
 output=root/'docs'/f'ritual-source-contact-{start+1:02d}-{start+10:02d}.jpg';sheet.save(output,quality=90)
 print(output)
