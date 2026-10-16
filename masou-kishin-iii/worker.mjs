import '../persona-q/jszip.min.js';
import {applyPatch} from '../odin-core.mjs';
import {hashBlob} from '../odin-sha256.mjs';
const validName=name=>typeof name==='string'&&/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(name)&&!name.split('/').some(x=>x==='..'||x==='.');
async function download(entry){const r=await fetch(new URL(entry.patch,import.meta.url));if(!r.ok)throw Error(`โหลดแพตช์ ${entry.name} ไม่สำเร็จ (${r.status})`);const parts=[];let count=0;const reader=r.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>entry.patch_size){await reader.cancel();throw Error('ขนาดแพตช์เกินที่ระบุ');}parts.push(value);}const blob=new Blob(parts);if(count!==entry.patch_size||await hashBlob(blob)!==entry.patch_sha256)throw Error(`ข้อมูลแพตช์เสียหาย: ${entry.name}`);return blob;}
export async function build(manifest,files,report=()=>{}){
 if(manifest.schema!==1||manifest.titleId!=='PCSG00190'||manifest.version!=='1.0'||manifest.files.length!==manifest.totalFiles||manifest.files.length>300)throw Error('ข้อมูลรุ่นไม่ถูกต้อง');
 const selected=new Map(files),zip=new globalThis.JSZip(),names=new Set();
 for(let index=0;index<manifest.files.length;index++){
  const entry=manifest.files[index];
  if(!validName(entry.name)||names.has(entry.name)||!/^patches\/\d{3}\.dat$/.test(entry.patch)||!Number.isSafeInteger(entry.target_size)||entry.target_size<1||entry.target_size>32*1024*1024||!Number.isSafeInteger(entry.patch_size)||entry.patch_size<1||entry.patch_size>40*1024*1024||![entry.target_sha256,entry.patch_sha256].every(x=>/^[0-9a-f]{64}$/.test(x)))throw Error('รายการไฟล์ไม่ถูกต้อง');
  names.add(entry.name);report(`ตรวจและสร้าง ${index+1}/${manifest.files.length} · ${entry.name}`,Math.floor(index/manifest.files.length*90));
  let output;
  if(entry.mode==='delta'){
   const source=selected.get(entry.name);if(!source)throw Error(`ไม่พบ ${entry.name}`);
   const sourceHash=await hashBlob(source);
   if(sourceHash===entry.target_sha256&&source.size===entry.target_size)output=source;
   else{if(sourceHash!==entry.source_sha256||source.size!==entry.source_size)throw Error(`ไฟล์ไม่ตรงต้นฉบับ PCSG00190 1.00: ${entry.name} กรุณาใช้ไฟล์สำรองที่ถอดรหัสและยังไม่ลงแพตช์`);output=await applyPatch(source,await download(entry),entry);}
  }else if(entry.mode==='auxiliary'){const patch=await download(entry);output=await new Response(patch.stream().pipeThrough(new DecompressionStream('gzip'))).blob();}
  else throw Error('รูปแบบไฟล์ไม่รองรับ');
  if(output.size!==entry.target_size||await hashBlob(output)!==entry.target_sha256)throw Error(`ผลลัพธ์ไม่ผ่านการตรวจสอบ: ${entry.name}`);
  zip.file(`rePatch/PCSG00190/${entry.name}`,await output.arrayBuffer());
 }
 const readmeResponse=await fetch(new URL('./README_TH.txt',import.meta.url));if(!readmeResponse.ok)throw Error('โหลดคู่มือติดตั้งไม่สำเร็จ');zip.file('README_TH.txt',await readmeResponse.text());
 zip.file('SHA256SUMS.txt',manifest.files.map(e=>`${e.target_sha256}  rePatch/PCSG00190/${e.name}`).join('\n')+'\n');
 report('จัดชุด rePatch พร้อมคู่มือติดตั้ง',92);
 const output=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},m=>report('จัดชุด rePatch พร้อมคู่มือติดตั้ง',92+Math.floor(m.percent*.08)));
 report('เสร็จแล้ว',100);return output;
}
if(typeof self!=='undefined'&&typeof document==='undefined')self.onmessage=async({data})=>{try{const output=await build(data.manifest,data.files,(phase,percent)=>self.postMessage({type:'progress',phase,percent}));self.postMessage({type:'done',output});}catch(e){self.postMessage({type:'error',message:e.message||'สร้างแพตช์ไม่สำเร็จ'});}};
