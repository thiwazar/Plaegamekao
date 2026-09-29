import {hashBlob} from './sha256.js';
import {applyDelta} from './vcdiff.js';
self.onmessage=async({data:{file,entry}})=>{
 const report=(phase,percent)=>self.postMessage({type:'progress',phase,percent:Math.round(percent)});
 try{
  if(file.size===entry.targetSize){const h=await hashBlob(file,p=>report('ตรวจไฟล์ที่เลือก',p*100));if(h===entry.targetSha256)throw Error('ไฟล์นี้เป็นแพตช์ไทยรุ่นนี้อยู่แล้ว ไม่ต้องลงซ้ำ');}
  if(file.size!==entry.sourceSize)throw Error('ขนาดไฟล์ไม่ตรงกับต้นฉบับที่รองรับ โปรดเลือกไฟล์สำรองที่ยังไม่เคยลงแพตช์');
  const sourceHash=await hashBlob(file,p=>report('ตรวจไฟล์ต้นฉบับ',p*40));
  if(sourceHash!==entry.sourceSha256)throw Error('ไฟล์ไม่ตรงกับต้นฉบับ PCSE00240 ที่รองรับ อาจเป็นคนละรุ่นหรือถูกแก้ไขแล้ว');
  report('ดาวน์โหลดข้อมูลแพตช์',42);
  const response=await fetch(new URL(entry.patch,import.meta.url));if(!response.ok)throw Error('ดาวน์โหลดแพตช์ไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่');
  const chunks=[];let loaded=0;const reader=response.body.getReader();
  while(true){const {value,done}=await reader.read();if(done)break;loaded+=value.length;if(loaded>entry.patchSize)throw Error('ขนาดแพตช์ไม่ถูกต้อง');chunks.push(value);report('ดาวน์โหลดข้อมูลแพตช์',42+loaded/entry.patchSize*10);}
  if(loaded!==entry.patchSize)throw Error('ดาวน์โหลดแพตช์ไม่ครบ กรุณาลองใหม่');
  const patch=new Blob(chunks);if(await hashBlob(patch)!==entry.patchSha256)throw Error('ข้อมูลแพตช์เสียหาย กรุณาโหลดหน้าเว็บใหม่');
  report('สร้างไฟล์ภาษาไทย',55);
  const output=applyDelta(file,new Uint8Array(await patch.arrayBuffer()),entry.targetSize);
  const outputHash=await hashBlob(output,p=>report('ตรวจไฟล์ภาษาไทย',58+p*42));
  if(outputHash!==entry.targetSha256)throw Error('ผลลัพธ์ไม่ผ่านการตรวจสอบ จึงยังไม่ให้ดาวน์โหลด กรุณาลองใหม่');
  self.postMessage({type:'done',output,name:entry.name,sha256:outputHash});
 }catch(error){self.postMessage({type:'error',message:error.message||'ไม่สามารถสร้างแพตช์ได้ กรุณาลองบนคอมพิวเตอร์'});}
};
