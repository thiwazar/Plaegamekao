import {GAMES,matchFiles,target,readme,makeZip} from './core.mjs';
import {hashBlob} from '../odin-sha256.mjs';
import {applyPatch} from '../odin-core.mjs';
import {applyDelta} from '../muramasa/vcdiff.js';
self.onmessage=async({data:{key,files}})=>{try{
 const game=GAMES[key];if(!game)throw Error('ไม่พบเกม');
 const report=(message)=>self.postMessage({type:'progress',message});
 const response=await fetch(new URL(game.manifest,import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('โหลด manifest ไม่สำเร็จ');
 const manifest=await response.json();if((manifest.titleId||manifest.title_id)!==game.id)throw Error('Manifest คนละเกม');
 const selected=matchFiles(files,manifest.files,game.id),results=[],checks=[];
 const assets=new URL(game.assets,import.meta.url);
 for(let i=0;i<selected.length;i++){
  const file=selected[i],requested=manifest.files[i],expected=target(requested);
  report(`${i+1}/${selected.length} ตรวจ ${file.name}`);
  const hash=await hashBlob(file);let output;
  if(file.size===expected.size&&hash===expected.hash){output=file;}
  else {
   const entry=[requested,...(requested.alternatives||[])].find(e=>file.size===(e.sourceSize??e.source_size)&&hash===(e.sourceSha256??e.source_sha256));
   if(!entry)throw Error(`${file.name} ไม่ตรงต้นฉบับหรือไฟล์ไทยที่รองรับ อาจยังเข้ารหัสหรือเป็นเกมคนละรุ่น`);
   report(`${i+1}/${selected.length} สร้าง ${file.name}`);
   const chunks=[];
   const parts=entry.parts||[{url:entry.patch,size:entry.patchSize,sha256:entry.patchSha256}];
   for(const part of parts){
    const r=await fetch(new URL(part.url,assets));if(!r.ok)throw Error(`โหลด ${part.url} ไม่สำเร็จ`);
    const blob=await r.blob();if(blob.size!==part.size||await hashBlob(blob)!==part.sha256)throw Error('แพตช์เสียหาย');chunks.push(blob);
   }
   const patch=new Blob(chunks);
   output=game.format==='vcdiff'?applyDelta(file,new Uint8Array(await patch.arrayBuffer()),expected.size):await applyPatch(file,patch,entry);
  }
  if(output.size!==expected.size||await hashBlob(output)!==expected.hash)throw Error(`ผลลัพธ์ ${file.name} ไม่ผ่าน SHA-256`);
  results.push({name:`rePatch/${game.id}/${requested.name}`,blob:output});checks.push({name:requested.name,size:output.size,sha256:expected.hash});
 }
 results.push({name:'README_TH.txt',blob:new Blob([readme(game,manifest.release||manifest.version)])});
 results.push({name:'verification.json',blob:new Blob([JSON.stringify({titleId:game.id,hardwareTested:false,files:checks},null,2)])});
 const zip=await makeZip(results,p=>report(`จัด ZIP ${Math.round(p*100)}% — เปิดแท็บนี้ไว้`));
 self.postMessage({type:'done',blob:zip,name:`${game.id}-Thai-rePatch-TEST.zip`});
}catch(e){self.postMessage({type:'error',message:e.message});}};
