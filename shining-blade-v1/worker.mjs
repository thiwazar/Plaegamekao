import '../vendor/sha256.umd.min.js';
import {decodeWindows} from './vcdiff.mjs';
import {PATCH} from './config.mjs';
const SOURCE_SIZE=1013305344, TARGET_SIZE=1013305344;
const SOURCE_HASH='61d9833f919b9af60c82e9b0ef9c501ee7b19eb9163f0472a151a86ae3e495e0';
const TARGET_HASH='ded21145e368a694a01090194dbc3ecaa44a5bb46162f23ddeae8fe17fa85a50';
const send=(type,data={})=>self.postMessage({type,...data});
const progress=(value,phase)=>send('progress',{value,phase});
const log=message=>send('log',{message});
async function digest(file){
 const h=await self.hashwasm.createSHA256();h.init();
 for(let p=0;p<file.size;p+=4*1024*1024){h.update(new Uint8Array(await file.slice(p,p+4*1024*1024).arrayBuffer()));progress(Math.floor(Math.min(p+4*1024*1024,file.size)/file.size*25),'กำลังตรวจ ISO');}
 return h.digest('hex');
}
self.onmessage=async({data})=>{
 if(data.type!=='start')return;
 try{
  const file=data.file;
  if(!file || !/\.iso$/i.test(file.name))throw new Error('กรุณาเลือกไฟล์ ISO โดยตรง');
  if(file.size!==SOURCE_SIZE && file.size!==TARGET_SIZE)throw new Error('ขนาด ISO ไม่ตรง: รุ่น v1 รองรับ Shining Blade (gugule).iso ขนาด 1,013,305,344 ไบต์');
  log('กำลังตรวจ SHA-256 ของ ISO ในเครื่อง…');
  const hash=await digest(file);
  if(file.size===TARGET_SIZE && hash===TARGET_HASH){log('ไฟล์นี้ตรงกับผลลัพธ์ภาษาไทย v1 อยู่แล้ว');send('complete',{file,alreadyPatched:true,sha256:hash});return;}
  if(file.size!==SOURCE_SIZE || hash!==SOURCE_HASH)throw new Error('ISO ไม่ตรงกับ Shining Blade (gugule) ที่รองรับ (SHA-256: '+hash+')');
  const manifest=PATCH;
  const outputHash=await self.hashwasm.createSHA256();outputHash.init();
  const outputParts=[];let total=0;
  log('กำลังโหลดแพตช์ประมาณ 307 MB — ISO ไม่ถูกอัปโหลด');
  for(let i=0;i<manifest.parts.length;i++){
   const part=manifest.parts[i];
   log('โหลดและตรวจแพตช์ส่วน '+(i+1)+'/'+manifest.parts.length);
   const r=await fetch(new URL(part.url,import.meta.url));
   if(!r.ok)throw new Error('โหลดแพตช์ส่วน '+(i+1)+' ไม่สำเร็จ ('+r.status+')');
   const patch=new Uint8Array(await r.arrayBuffer());
   if(patch.length!==part.size || await self.hashwasm.sha256(patch)!==part.sha256)throw new Error('แพตช์ส่วน '+(i+1)+' เสียหายหรือโหลดไม่ครบ กรุณาลองใหม่');
   let partWritten=0;
   for await(const window of decodeWindows(file,patch,part.targetSize)){
    outputHash.update(window.bytes);outputParts.push(...window.parts);partWritten=window.written;
    progress(25+Math.floor((total+partWritten)/TARGET_SIZE*74),'กำลังสร้าง ISO ภาษาไทย v1');
   }
   total+=partWritten;
  }
  if(total!==TARGET_SIZE || outputHash.digest('hex')!==TARGET_HASH)throw new Error('ผลลัพธ์ไม่ตรงกับ ISO ภาษาไทย Shining Blade v1 ระบบยกเลิกไฟล์ผลลัพธ์');
  const output=new Blob(outputParts,{type:'application/octet-stream'});
  if(output.size!==TARGET_SIZE)throw new Error('ขนาดไฟล์ผลลัพธ์ไม่ครบ');
  log('ตรวจ SHA-256 ผ่าน: ตรงกับ ISO ภาษาไทย Shining Blade v1ทุกไบต์');
  send('complete',{file:output,sha256:TARGET_HASH});
 }catch(error){send('error',{message:error.message});}
};
