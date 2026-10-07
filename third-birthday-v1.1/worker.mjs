import '../vendor/sha256.umd.min.js';
import {decodeWindows} from './vcdiff.mjs';
const SOURCE_SIZE=1387927552, TARGET_SIZE=1468573696;
const SOURCE_HASH='2fb32105671fb740cd0b28ee228d262b1874caab3f55c95481e43efe157dba72';
const TARGET_HASH='0fd98685111a79704af15fe0346eedc811338e1e09789050c6df7e00cd83403a';
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
  if(file.size!==SOURCE_SIZE && file.size!==TARGET_SIZE)throw new Error('ขนาด ISO ไม่ตรง: รุ่น 1.1 รองรับ The_3rd_Birthday_EUR_UNDUB.iso ขนาด 1,387,927,552 ไบต์');
  log('กำลังตรวจ SHA-256 ของ ISO ในเครื่อง…');
  const hash=await digest(file);
  if(file.size===TARGET_SIZE && hash===TARGET_HASH){log('ไฟล์นี้ตรงกับผลลัพธ์ภาษาไทย 1.1 อยู่แล้ว');send('complete',{file,alreadyPatched:true,sha256:hash});return;}
  if(file.size!==SOURCE_SIZE || hash!==SOURCE_HASH)throw new Error('ISO ไม่ตรงกับ EUR UNDUB ที่รองรับ (SHA-256: '+hash+')');
  const response=await fetch(new URL('./manifest.json',import.meta.url));
  if(!response.ok)throw new Error('โหลดข้อมูลแพตช์ไม่ได้ ('+response.status+')');
  const manifest=await response.json();
  if(manifest.sourceSha256!==SOURCE_HASH || manifest.targetSha256!==TARGET_HASH || manifest.targetSize!==TARGET_SIZE || !Array.isArray(manifest.parts) || manifest.parts.length!==32)throw new Error('ข้อมูลแพตช์ไม่ตรงกับรุ่น 1.1');
  const outputHash=await self.hashwasm.createSHA256();outputHash.init();
  const outputParts=[];let total=0;
  log('กำลังโหลดแพตช์ประมาณ 555 MB ทีละส่วน — ISO ไม่ถูกอัปโหลด');
  for(let i=0;i<manifest.parts.length;i++){
   const part=manifest.parts[i];
   if(!/^patch-\d{3}\.vcdiff$/.test(part.url) || part.size>20*1024*1024)throw new Error('รายการไฟล์แพตช์ไม่ถูกต้อง');
   log('โหลดและตรวจแพตช์ส่วน '+(i+1)+'/'+manifest.parts.length);
   const r=await fetch(new URL(part.url,import.meta.url));
   if(!r.ok)throw new Error('โหลดแพตช์ส่วน '+(i+1)+' ไม่สำเร็จ ('+r.status+')');
   const patch=new Uint8Array(await r.arrayBuffer());
   if(patch.length!==part.size || await self.hashwasm.sha256(patch)!==part.sha256)throw new Error('แพตช์ส่วน '+(i+1)+' เสียหายหรือโหลดไม่ครบ กรุณาลองใหม่');
   let partWritten=0;
   for await(const window of decodeWindows(file,patch,part.targetSize)){
    outputHash.update(window.bytes);outputParts.push(...window.parts);partWritten=window.written;
    progress(25+Math.floor((total+partWritten)/TARGET_SIZE*74),'กำลังสร้าง ISO ภาษาไทย 1.1');
   }
   total+=partWritten;
  }
  if(total!==TARGET_SIZE || outputHash.digest('hex')!==TARGET_HASH)throw new Error('ผลลัพธ์ไม่ตรงกับ ISO ภาษาไทยอ้างอิง ระบบยกเลิกไฟล์ผลลัพธ์');
  const output=new Blob(outputParts,{type:'application/octet-stream'});
  if(output.size!==TARGET_SIZE)throw new Error('ขนาดไฟล์ผลลัพธ์ไม่ครบ');
  log('ตรวจ SHA-256 ผ่าน: ตรงกับ ISO ภาษาไทยอ้างอิงทุกไบต์');
  send('complete',{file:output,sha256:TARGET_HASH});
 }catch(error){send('error',{message:error.message});}
};
