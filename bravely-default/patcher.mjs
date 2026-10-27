// QGDELTA2 format follows thiwazar/Plaegamekao/persona-q2.
// Keep the original 4 GiB file in file-backed Blob slices, never one ArrayBuffer.
export async function hashBlob(blob, progress=()=>{}) {
 const h=await globalThis.hashwasm.createSHA256();h.init();
 for(let off=0;off<blob.size;off+=4194304){h.update(new Uint8Array(await blob.slice(off,off+4194304).arrayBuffer()));progress(Math.min(1,(off+4194304)/blob.size));}
 return h.digest('hex');
}
export async function applyPatch(file,m,progress=()=>{},log=()=>{}) {
 if(m.format!=='QGDELTA2'||file.size!==m.sourceSize)throw Error('ขนาดไฟล์ไม่ตรง ต้องใช้ Bravely Default USA .3ds ต้นฉบับ 4,294,967,296 ไบต์');
 log('กำลังตรวจรอมต้นฉบับ…');
 if(await hashBlob(file,n=>progress(Math.round(n*30)))!==m.sourceSha256)throw Error('SHA-256 ไม่ตรงรุ่นที่รองรับ หรือรอมเคยถูกแก้ไขแล้ว');
 const r=await fetch(new URL(m.patchUrl,import.meta.url));if(!r.ok)throw Error('โหลดแพตช์ไม่ได้: '+r.status);
 const patch=await r.blob();
 if(patch.size!==m.patchSize||await hashBlob(patch)!==m.patchSha256)throw Error('แพตช์ไม่ครบหรือเสียหาย');
 const z=await globalThis.JSZip.loadAsync(await patch.arrayBuffer());
 const index=z.file('index.json');if(!index)throw Error('แพตช์ไม่มีดัชนี');
 const {format,ops}=JSON.parse(await index.async('string'));
 if(format!=='QGDELTA2'||!Array.isArray(ops)||ops.length>2000000)throw Error('รูปแบบแพตช์ไม่ถูกต้อง');
 const parts=[];let size=0;
 log('กำลังประกอบไฟล์ภาษาไทยในเครื่องคุณ…');
 for(let i=0;i<ops.length;i++){
  const op=ops[i];if(!Number.isSafeInteger(op.length)||op.length<=0||size+op.length>m.targetSize)throw Error('ความยาวชิ้นส่วนแพตช์ไม่ถูกต้อง');
  if(Object.hasOwn(op,'copy')){
   if(Object.hasOwn(op,'data')||!Number.isSafeInteger(op.copy)||op.copy<0||op.copy+op.length>file.size)throw Error('ตำแหน่งข้อมูลเกินรอม');
   parts.push(file.slice(op.copy,op.copy+op.length));
  }else{
   if(typeof op.data!=='string'||!z.file(op.data))throw Error('ข้อมูลแพตช์ขาด');
   const bytes=await z.file(op.data).async('uint8array');if(bytes.length!==op.length)throw Error('ชิ้นส่วนแพตช์ไม่ครบ');parts.push(bytes);
  }
  size+=op.length;if(i%100===0)progress(30+Math.round((i+1)/ops.length*30));
 }
 const output=new Blob(parts,{type:'application/octet-stream'});
 if(size!==m.targetSize||output.size!==m.targetSize)throw Error('ผลลัพธ์มีขนาดไม่ตรง');
 log('กำลังตรวจไฟล์ภาษาไทยก่อนดาวน์โหลด…');
 if(await hashBlob(output,n=>progress(60+Math.round(n*40)))!==m.targetSha256)throw Error('ตรวจผลลัพธ์ไม่ผ่าน จึงไม่เปิดให้ดาวน์โหลด');
 log('ตรวจสอบผ่าน พร้อมดาวน์โหลด');return output;
}

