import '../vendor/sha256.umd.min.js';
import {decodeWindows} from '../fontfix-vcdiff.mjs';

const SOURCE_SIZE=3234037760;
const SOURCE_SHA='553416634354781b2b3d0a504e8ea4f87bea070bed59f089135c8ac81c2b9cc2';
const TARGET_SIZE=3234074624;
const TARGET_SHA='6a6454ebb23fc0414aba6c9ea29dfcfb91491502eb45ea61eef5bc81a7e97c3b';
const PATCH_SIZE=2277142;
const PATCH_SHA='4443005c49ecee7cf4656cc68aeb442422055d3e152960e2c34bda0bb4ec2fc0';
let acknowledge=null;
const send=(type,extra={})=>self.postMessage({type,...extra});
const progress=(value,phase)=>send('progress',{value,phase});

self.onmessage=({data})=>{
  if(data.type==='ack'&&acknowledge){const done=acknowledge;acknowledge=null;done();return;}
  if(data.type==='start')run(data.file);
};

async function hashFile(file){
  const hash=await self.hashwasm.createSHA256();hash.init();
  for(let offset=0;offset<file.size;offset+=4*1024*1024){
    const bytes=new Uint8Array(await file.slice(offset,offset+4*1024*1024).arrayBuffer());
    hash.update(bytes);progress(Math.floor((offset+bytes.length)/file.size*30),'กำลังตรวจ ISO ต้นทาง');
  }
  return hash.digest('hex');
}

async function run(file){
  try{
    if(!file||!file.name.toLowerCase().endsWith('.iso'))throw Error('กรุณาเลือกไฟล์ .iso');
    if(file.size!==SOURCE_SIZE)throw Error('ขนาด ISO ไม่ตรงกับรุ่นที่รองรับ');
    send('log',{message:'กำลังตรวจ ISO ทีละส่วน ไฟล์เกมไม่ถูกส่งขึ้นเว็บ'});
    const sourceHash=await hashFile(file);
    if(sourceHash!==SOURCE_SHA)throw Error('SHA-256 ของ ISO ต้นทางไม่ตรงกับรุ่นที่รองรับ: '+sourceHash);
    send('log',{message:'ISO ต้นทางถูกต้อง กำลังโหลดข้อมูลแพตช์'});
    const response=await fetch(new URL('./tod2-thai-v1.dat',import.meta.url),{cache:'no-cache'});
    if(!response.ok)throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ ('+response.status+')');
    const patch=new Uint8Array(await response.arrayBuffer());
    if(patch.length!==PATCH_SIZE||await self.hashwasm.sha256(patch)!==PATCH_SHA)throw Error('ข้อมูลแพตช์บนเว็บไม่ถูกต้อง');
    const outputHash=await self.hashwasm.createSHA256();outputHash.init();
    send('log',{message:'กำลังสร้าง ISO ภาษาไทยทีละส่วน โปรดเปิดหน้านี้ไว้'});
    for await(const window of decodeWindows(file,patch,TARGET_SIZE)){
      outputHash.update(window.bytes);
      progress(32+Math.floor(window.written/TARGET_SIZE*65),'กำลังแพตช์ ISO');
      const bytes=window.bytes;
      self.postMessage({type:'chunk',bytes,written:window.written},[bytes.buffer]);
      await new Promise(resolve=>{acknowledge=resolve;});
    }
    const result=outputHash.digest('hex');
    if(result!==TARGET_SHA)throw Error('SHA-256 ของ ISO หลังแพตช์ไม่ตรง ระบบยกเลิกไฟล์ผลลัพธ์');
    progress(100,'ตรวจผลลัพธ์สำเร็จ');send('complete',{sha256:result,size:TARGET_SIZE});
  }catch(error){send('error',{message:error.message||String(error)});}
}
