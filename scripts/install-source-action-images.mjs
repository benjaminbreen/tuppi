import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const write=(name,data)=>fs.writeFileSync(path.join(root,name),JSON.stringify(data,null,2)+'\n');
const manifest=read('docs/ritual-source-image-manifest.json');
const units=read('src/data/rituals/units.json');
const visuals=read('src/data/rituals/visual-assets.json');
const imageMapPath=path.join(root,'src/data/rituals/source-action-images.json');
const sourceImages=fs.existsSync(imageMapPath)?JSON.parse(fs.readFileSync(imageMapPath,'utf8')):{};
for(const item of manifest){
 const receipt=path.join(root,'docs/ritual-image-results',item.number.toString().padStart(2,'0')+'.json');
 const result=fs.existsSync(receipt)?JSON.parse(fs.readFileSync(receipt,'utf8')):null;
 if(result?.status==='failed'){item.status='blocked-by-image-service';item.error=result.error;continue;}
 if(item.number!==1 && result?.status!=='generated')continue;
 const file=path.join(root,'public',item.target);
 if(!fs.existsSync(file))continue;
 const bytes=fs.readFileSync(file);
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || ![4,6].includes(bytes[25]))throw new Error(`Invalid transparent PNG: ${file}`);
 const visualId=`source-action-${item.number.toString().padStart(2,'0')}`;
 visuals[visualId]={src:item.target,subject:units[item.unitId].title,medium:'AI reconstruction · transparent PNG'};
 units[item.unitId].visualAssetId=visualId;
 sourceImages[item.id]=item.target;
 item.status='installed';
 delete item.error;
 if(result?.prompt)item.prompt=result.prompt;
 if(result?.source)item.generatedSource=result.source;
}
const used=new Set(Object.values(units).map(u=>u.visualAssetId));
for(const id of Object.keys(visuals))if(!used.has(id))delete visuals[id];
write('src/data/rituals/units.json',units);
write('src/data/rituals/visual-assets.json',visuals);
write('src/data/rituals/source-action-images.json',sourceImages);
write('docs/ritual-source-image-manifest.json',manifest);
console.log(`Installed ${Object.keys(sourceImages).length}/${manifest.length} source action images.`);
