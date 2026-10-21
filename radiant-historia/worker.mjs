import loadXdelta from '../xdelta3-big.js';
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const update=(value,message)=>postMessage({value,message});
self.onmessage=async ({data:{file}})=>{
  let mod; const ptrs=[];
  try {
    const response=await fetch('./manifest.json');
    if(!response.ok) throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ');
    const g=await response.json();
    if(file.size!==g.sourceSize) throw Error('ขนาดไฟล์ไม่ตรง กรุณาใช้ Radiant Historia (USA) ต้นฉบับ ขนาด 128 MiB');
    update(5,'กำลังตรวจสอบรอมต้นฉบับ...');
    const source=await file.arrayBuffer();
    if(await hash(source)!==g.sourceSha256) throw Error('รอมไม่ตรงกับรุ่น USA ที่รองรับ หรือผ่านการดัดแปลงแล้ว');
    update(20,'ต้นฉบับถูกต้อง กำลังโหลดและตรวจแพตช์...');
    const patchResponse=await fetch(g.patchUrl);
    if(!patchResponse.ok) throw Error('โหลดแพตช์ไม่สำเร็จ กรุณาลองใหม่');
    const patch=await patchResponse.arrayBuffer();
    if(await hash(patch)!==g.patchSha256) throw Error('ไฟล์แพตช์เสียหาย กรุณารีเฟรชหน้าเว็บ');
    mod=await loadXdelta();
    const alloc=n=>{const p=mod._malloc(n);if(!p)throw Error('หน่วยความจำไม่พอ กรุณาปิดแท็บอื่นแล้วลองใหม่');ptrs.push(p);return p;};
    // xdelta needs decoding headroom beyond the final file length.
    const outMax=g.targetSize+50*1024*1024;
    const p=alloc(patch.byteLength),s=alloc(source.byteLength),o=alloc(outMax),n=alloc(4);
    mod.HEAPU8.set(new Uint8Array(patch),p);mod.HEAPU8.set(new Uint8Array(source),s);
    update(45,'กำลังแปะแพตช์ภาษาไทย...');
    const ret=mod._xd3_decode_memory(p,patch.byteLength,s,source.byteLength,o,n,outMax,0);
    if(ret!==0)throw Error('แปะแพตช์ไม่สำเร็จ (xdelta '+ret+')');
    if(mod.getValue(n,'i32')!==g.targetSize)throw Error('ขนาดผลลัพธ์ไม่ตรง: '+mod.getValue(n,'i32'));
    update(85,'กำลังตรวจสอบไฟล์ภาษาไทย...');
    const output=mod.HEAPU8.subarray(o,o+g.targetSize);
    if(await hash(output)!==g.targetSha256)throw Error('ผลลัพธ์ไม่ตรงกับแพตช์รุ่นนี้');
    postMessage({done:true,blob:new Blob([output],{type:'application/octet-stream'}),name:g.outName});
  }catch(error){postMessage({error:error.message});}
  finally{if(mod)ptrs.forEach(p=>mod._free(p));}
};
