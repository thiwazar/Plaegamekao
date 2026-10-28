import loadXdelta from '../xdelta3-big.js';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const update=(value,message)=>postMessage({value,message});
self.onmessage=async({data:{file}})=>{
  let mod;const ptrs=[];
  try{
    const mr=await fetch('./manifest.json');if(!mr.ok)throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ');
    const g=await mr.json();
    if(file.size!==g.sourceSize)throw Error('ขนาดไฟล์ไม่ตรง กรุณาใช้ ROM USA ต้นฉบับ ขนาด 1,283,168,256 ไบต์');
    update(5,'กำลังอ่านและตรวจ SHA-256 ของรอมต้นฉบับ...');
    const source=await file.arrayBuffer();if(await hash(source)!==g.sourceSha256)throw Error('ROM ไม่ตรงกับรุ่น USA ที่รองรับ หรือผ่านการดัดแปลงแล้ว');
    update(20,'ต้นฉบับถูกต้อง กำลังโหลดและตรวจแพตช์...');
    const pr=await fetch(g.patchUrl);if(!pr.ok)throw Error('โหลดไฟล์แพตช์ไม่สำเร็จ');const patch=await pr.arrayBuffer();
    if(await hash(patch)!==g.patchSha256)throw Error('ไฟล์แพตช์เสียหาย กรุณารีเฟรชหน้า');
    mod=await loadXdelta();
    const alloc=n=>{const p=mod._malloc(n);if(!p)throw Error('หน่วยความจำไม่พอ กรุณาปิดแท็บอื่นแล้วลองใหม่');ptrs.push(p);return p;};
    const outMax=g.targetSize+50*1024*1024,p=alloc(patch.byteLength),s=alloc(source.byteLength),o=alloc(outMax),n=alloc(4);
    mod.HEAPU8.set(new Uint8Array(patch),p);mod.HEAPU8.set(new Uint8Array(source),s);
    update(45,'กำลังแปะแพตช์ภาษาไทย...');const ret=mod._xd3_decode_memory(p,patch.byteLength,s,source.byteLength,o,n,outMax,0);
    if(ret!==0)throw Error('แปะแพตช์ไม่สำเร็จ (xdelta '+ret+')');if(mod.getValue(n,'i32')!==g.targetSize)throw Error('ขนาดไฟล์ผลลัพธ์ไม่ตรง');
    update(85,'กำลังตรวจ SHA-256 ของไฟล์ภาษาไทย...');const output=mod.HEAPU8.subarray(o,o+g.targetSize);
    if(await hash(output)!==g.targetSha256)throw Error('ผลลัพธ์ไม่ตรงกับแพตช์รุ่นนี้');
    postMessage({done:true,blob:new Blob([output],{type:'application/octet-stream'}),name:g.outName});
  }catch(error){postMessage({error:error.message});}
  finally{if(mod)ptrs.forEach(p=>mod._free(p));}
};
