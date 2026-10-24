import {decodeWindows} from './decoder.mjs';
import {hashBlob,Sha256} from './sha256.mjs';
export async function applyPatch(file,variant,patch,onProgress=()=>{}) {
  if(file.size!==variant.sourceSize)throw Error('ขนาดไฟล์ไม่ตรง กรุณาเลือกเกม v1.0.5 (USA) ให้ตรงกับช่องที่เลือก');
  onProgress('กำลังตรวจไฟล์เกม',0);
  if(await hashBlob(file,p=>onProgress('กำลังตรวจไฟล์เกม',p*40))!==variant.sourceSha256)throw Error('ไฟล์ไม่ตรงกับเวอร์ชันนี้ กรุณาเลือก Normal สีแดง หรือ Belnades สีน้ำเงินให้ตรงกัน และใช้ไฟล์ที่ยังไม่ได้ลงภาษาไทย');
  if(await hashBlob(new Blob([patch]))!==variant.patchSha256)throw Error('ข้อมูลแพตช์ไม่ครบ กรุณาโหลดหน้านี้ใหม่');
  const parts=[],hash=new Sha256();
  for await(const window of decodeWindows(file,patch,variant.targetSize)){
    hash.update(window.bytes);parts.push(...window.parts);onProgress('กำลังสร้างเกมภาษาไทย',40+window.written/variant.targetSize*60);
  }
  if(hash.hex()!==variant.targetSha256)throw Error('ตรวจไฟล์ผลลัพธ์ไม่ผ่าน กรุณาลองใหม่');
  return new Blob(parts,{type:'application/octet-stream'});
}
