import {Resvg} from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'public/board-assets'),sizes={};
for(const file of await fs.readdir(dir)){
 if(!file.endsWith('.svg')||file==='anchor.svg')continue;
 const svg=await fs.readFile(path.join(dir,file),'utf8');
 const width=file.includes('tear-')&&!file.startsWith('scratch')?216:file.startsWith('scroll')?224:file.startsWith('paper')||file.startsWith('aged')?216:file==='scratch-tear.svg'?512:120;
 const image=new Resvg(svg,{fitTo:{mode:'width',value:width}}).render(),name=file.replace('.svg','.png');
 await fs.writeFile(path.join(dir,name),image.asPng());sizes[name]={width:image.width,height:image.height};
}
await fs.writeFile(path.join(root,'src/board-asset-sizes.js'),'export default '+JSON.stringify(sizes)+';\n');
console.log('Prepared',Object.keys(sizes).length,'board paints');
