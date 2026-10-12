export async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
const table = Uint32Array.from({length:256}, (_, n) => {
  for (let j=0;j<8;j++) n = (n>>>1) ^ ((n&1)?0xedb88320:0);
  return n>>>0;
});
export function crc32(bytes) {
  let c=0xffffffff;
  for (const b of bytes) c=table[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
// BPS1 linear patches generated for this release use SourceRead and TargetRead.
export function applyBps(source, patch, expectedSize) {
  if (patch.length<19 || String.fromCharCode(...patch.subarray(0,4))!=='BPS1') throw new Error('รูปแบบแพตช์ไม่ถูกต้อง');
  const view=new DataView(patch.buffer,patch.byteOffset,patch.byteLength), end=patch.length-12;
  if (crc32(patch.subarray(0,-4))!==view.getUint32(patch.length-4,true)) throw new Error('ไฟล์แพตช์เสียหาย');
  let p=4;
  function number() {
    let value=0,shift=1;
    for(let count=0;count<8;count++) {
      if(p>=end) throw new Error('ข้อมูลแพตช์ไม่ครบ');
      const b=patch[p++];value+=(b&127)*shift;
      if(!Number.isSafeInteger(value)) throw new Error('ขนาดแพตช์ไม่ถูกต้อง');
      if(b&128)return value;
      shift*=128;value+=shift;
    }
    throw new Error('รหัสแพตช์ยาวเกินกำหนด');
  }
  const sourceSize=number(),targetSize=number(),metadataSize=number();
  if(sourceSize!==source.length || targetSize!==expectedSize) throw new Error('ขนาด ROM ไม่ตรงกับแพตช์');
  if(crc32(source)!==view.getUint32(end,true)) throw new Error('ROM ต้นฉบับไม่ตรงกับแพตช์');
  p+=metadataSize;if(p>end)throw new Error('ข้อมูลแพตช์ไม่ครบ');
  const output=new Uint8Array(targetSize);let pos=0;
  while(p<end) {
    const action=number(),mode=action%4,length=Math.floor(action/4)+1;
    if(pos+length>output.length)throw new Error('ข้อมูลเกินขนาด ROM');
    if(mode===0) {
      if(pos+length>source.length)throw new Error('ข้อมูลต้นฉบับไม่ครบ');
      output.set(source.subarray(pos,pos+length),pos);
    } else if(mode===1) {
      if(p+length>end)throw new Error('ข้อมูลแพตช์ไม่ครบ');
      output.set(patch.subarray(p,p+length),pos);p+=length;
    } else throw new Error('คำสั่งแพตช์ไม่รองรับในรุ่นนี้');
    pos+=length;
  }
  if(p!==end || pos!==output.length || crc32(output)!==view.getUint32(end+4,true)) throw new Error('ผลลัพธ์ไม่ผ่านการตรวจสอบ');
  return output;
}
export async function patchRom(source, patch, manifest, progress=()=>{}) {
  if(source.length!==manifest.sourceSize)throw new Error('ขนาดไฟล์ไม่ตรง: ต้องใช้ ROM ญี่ปุ่นต้นฉบับ .nds ขนาด 67,108,864 ไบต์ (64 MiB)');
  if(String.fromCharCode(...source.subarray(12,16))!==manifest.gameCode)throw new Error('ภูมิภาคไม่ตรง: กรุณาใช้ ROM Japan (JAP/JP) รหัส YR9J ไม่ใช่ USA/EUR');
  progress('กำลังตรวจ SHA-256 ของ ROM ญี่ปุ่น…');
  if(await sha256(source)!==manifest.sourceSha256)throw new Error('ROM ไม่ตรงกับต้นฉบับที่รองรับ กรุณาใช้ Japan ที่ยังไม่แปลหรือดัดแปลง และตรวจ SHA-256 ด้านล่าง');
  if(await sha256(patch)!==manifest.patchSha256)throw new Error('แพตช์ไม่ผ่านการตรวจสอบ กรุณาโหลดหน้าใหม่');
  progress('กำลังสร้าง ROM ภาษาไทย v1.5…');
  const output=applyBps(source,patch,manifest.targetSize);
  progress('กำลังตรวจสอบไฟล์ภาษาไทย…');
  if(await sha256(output)!==manifest.targetSha256)throw new Error('ไฟล์ภาษาไทยไม่ผ่านการตรวจสอบ จึงไม่สร้างลิงก์ดาวน์โหลด');
  return output;
}
