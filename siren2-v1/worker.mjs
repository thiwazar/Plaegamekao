import {RELEASE,validateSource,loadPatch,applyToWriter} from './core.mjs?v=stall-fix-1';
let running=false;
self.onmessage=async ({data})=>{
  if(running)return;running=true;let writer;
  const progress=(phase,value)=>self.postMessage({type:'progress',phase,value});
  try{
    const {file,sourceHandle,outputHandle}=data;
    if(await sourceHandle.isSameEntry(outputHandle))throw Error('ห้ามเลือกไฟล์ต้นฉบับเป็นไฟล์ปลายทาง กรุณาใช้ชื่อ Forbidden_Siren_2_Thai_v1.0.iso');
    await validateSource(file,p=>progress('ตรวจ ISO ต้นฉบับ',p*40));
    const manifestUrl=new URL('./manifest.json',import.meta.url);
    const response=await fetch(manifestUrl,{cache:'no-cache'});
    if(!response.ok)throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ');
    const manifest=await response.json();
    const patch=await loadPatch(manifest,manifestUrl,p=>progress('ดาวน์โหลดแพตช์',40+p*10));
    writer=await outputHandle.createWritable();
    const result=await applyToWriter(file,patch,writer,p=>progress('เขียน ISO ภาษาไทยลงไดรฟ์',50+p*49),(phase,p)=>progress(phase,50+p*49));
    progress('บันทึกไฟล์ขั้นสุดท้าย กรุณารอไดรฟ์ทำงานเสร็จ',99);
    await writer.close();writer=null;
    self.postMessage({type:'done',...result,name:RELEASE.outName});
  }catch(error){if(writer)await writer.abort().catch(()=>{});self.postMessage({type:'error',message:error.message||String(error)});}
  finally{running=false;}
};
