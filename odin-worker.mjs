import {hashBlob} from './odin-sha256.mjs';
import {applyPatch,verifySource} from './odin-core.mjs?v=eboot5-v1';
self.onmessage=async({data:{file,entry:requestedEntry}})=>{
 const report=(phase,percent)=>self.postMessage({type:'progress',phase,percent:Math.round(percent)});
 try {
  const entry=[requestedEntry,...(requestedEntry.alternatives||[])].find(e=>e.source_size===file.size);
  if(!entry)throw Error('ขนาดต้นฉบับไม่ตรงรุ่นที่รองรับ');
  await verifySource(file,entry,p=>report('ตรวจไฟล์ต้นฉบับ',p*30));
  const chunks=[];let total=0;
  for(const part of entry.parts) {
   const response=await fetch(new URL(part.url,import.meta.url));if(!response.ok)throw Error('โหลดแพตช์ไม่สำเร็จ กรุณาลองใหม่');
   const reader=response.body.getReader(),pieces=[];let size=0;
   try {while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>part.size)throw Error('ขนาดแพตช์ไม่ถูกต้อง');pieces.push(r.value);report('ดาวน์โหลดข้อมูลแพตช์',30+(total+size)/entry.patch_size*15);}} finally{try{await reader.cancel();}catch{}}
   const blob=new Blob(pieces);if(size!==part.size||await hashBlob(blob)!==part.sha256)throw Error('ดาวน์โหลดแพตช์ไม่ครบหรือข้อมูลเสียหาย');chunks.push(blob);total+=size;
  }
  report('สร้างไฟล์ภาษาไทย',45);
  const output=await applyPatch(file,new Blob(chunks),entry,p=>report('สร้างไฟล์ภาษาไทย',45+p*20));
  const hash=await hashBlob(output,p=>report('ตรวจไฟล์ผลลัพธ์',65+p*35));
  if(hash!==entry.target_sha256)throw Error('ผลลัพธ์ไม่ผ่านการตรวจสอบ จึงไม่เปิดให้ดาวน์โหลด');
  self.postMessage({type:'done',output,name:entry.name,sha256:hash});
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
