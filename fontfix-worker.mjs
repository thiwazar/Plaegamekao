import './vendor/sha256.umd.min.js';
import {FONTFIX_GAME as game} from './fontfix-config.mjs';
import {decodeWindows} from './fontfix-vcdiff.mjs';
const send = (type, data={}) => self.postMessage({type,...data});
const log = message => send('log',{message});
const progress = (value,phase) => send('progress',{value,phase});
async function digest(file, onProgress) {
  const h = await self.hashwasm.createSHA256();h.init();
  const chunk=4*1024*1024;
  for(let offset=0;offset<file.size;offset+=chunk){const data=new Uint8Array(await file.slice(offset,offset+chunk).arrayBuffer());h.update(data);onProgress(Math.min(offset+data.length,file.size)/file.size);}
  return h.digest('hex');
}
self.onmessage = async ({data}) => {
  if(data.type!=='start')return;
  let materializedBytes=0;
  try {
    const file=data.file;
    if(!file || !/\.iso$/i.test(file.name))throw new Error('กรุณาเลือกไฟล์ .iso โดยตรง ไม่ใช่ ZIP หรือ CSO');
    if(![...game.sources.map(s=>s.size),game.targetSize].includes(file.size))throw new Error('ขนาด ISO ไม่ตรงกับรุ่นที่รองรับ กรุณาเลือก EUR FULL UNDUB หรือไทย v1.3');
    log('กำลังตรวจไฟล์ต้นทางทีละส่วน…');
    const hash=await digest(file,p=>progress(Math.round(p*30),'กำลังตรวจ ISO ต้นทาง'));
    if(file.size===game.targetSize && hash===game.targetSha256){log('ไฟล์นี้เป็น FontFix TEST ที่ถูกต้องอยู่แล้ว ไม่ต้องแพตช์ซ้ำ');send('complete',{file,alreadyPatched:true,sha256:hash});return;}
    const selected=game.sources.find(s=>s.size===file.size && s.sha256===hash);
    if(!selected)throw new Error('SHA-256 ไม่ตรงกับไฟล์ที่รองรับ ระบบหยุดโดยไม่แก้ต้นฉบับ (ได้ '+hash+')');
    log('ตรวจพบ '+selected.name+' — เลือกแพตช์ตรงรุ่นแล้ว');send('source',{name:selected.name});
    log('กำลังโหลดแพตช์ขนาด '+(selected.patchSize/1024/1024).toFixed(2)+' MB…');
    const response=await fetch(new URL(selected.patchUrl,self.location.href),{cache:'no-cache'});
    if(!response.ok)throw new Error('โหลดแพตช์ไม่สำเร็จ ('+response.status+') กรุณาตรวจว่าอัปโหลดไฟล์แพตช์ครบ');
    const patch=new Uint8Array(await response.arrayBuffer());
    if(patch.length!==selected.patchSize || await self.hashwasm.sha256(patch)!==selected.patchSha256)throw new Error('ไฟล์แพตช์บนเว็บไม่ตรงกับรุ่นนี้ กรุณารีโหลดหน้าเว็บหรือตรวจไฟล์ที่อัปโหลด');
    const outputParts=[];
    const outputHash=await self.hashwasm.createSHA256();outputHash.init();
    log('กำลังแพตช์ทีละส่วนและตรวจผลลัพธ์… ISO ไม่ถูกส่งขึ้นเว็บ');
    for await(const window of decodeWindows(file,patch,game.targetSize)){
      outputHash.update(window.bytes);for(const part of window.parts)outputParts.push(part);materializedBytes+=window.materializedBytes;
      progress(32+Math.floor(window.written/game.targetSize*65),'กำลังแพตช์ ISO');
    }
    const resultHash=outputHash.digest('hex');
    if(resultHash!==game.targetSha256)throw new Error('SHA-256 ผลลัพธ์ไม่ตรง ระบบยกเลิกไฟล์ผลลัพธ์');
    const output=new Blob(outputParts,{type:'application/octet-stream'});
    if(output.size!==game.targetSize)throw new Error('บันทึก ISO ได้ขนาดไม่ครบ');
    log('ตรวจ SHA-256 ผลลัพธ์ตรงกัน ✓ กดดาวน์โหลด ISO ได้เลย');progress(100,'แพตช์สำเร็จ');
    send('complete',{file:output,source:selected.name,sha256:resultHash,materializedBytes});
  }catch(error){
    send('error',{message:error.name==='QuotaExceededError'?'เบราว์เซอร์มีพื้นที่ไม่พอ กรุณาใช้โหมดปกติ ปิดแท็บอื่น และเพิ่มพื้นที่ว่าง':error.message});
  }
};
