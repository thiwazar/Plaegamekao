import {Sha256, hashBlob} from './sha256.mjs';
import {decodeWindows} from './vcdiff.mjs?v=stall-fix-1';
export const RELEASE = Object.freeze({
  version:'1.0', gameId:'SCES-53851', region:'Europe / PAL',
  sourceSize:5844074496,
  sourceSha256:'019d6cea66328a9d9c99205141223f442fd8597f84ba021c01120824464cbfe7',
  targetSize:5844074496,
  targetSha256:'479a8d73b990cc4f20213b11672bdd43ba492e247e1cd89561e6d99a2f3f92c4',
  outName:'Forbidden_Siren_2_Thai_v1.0.iso'
});
const fail = text => {throw new Error(text);};
export async function validateSource(source, progress=()=>{}) {
  if (source.size!==RELEASE.sourceSize) fail('ขนาด ISO ไม่ตรง ต้องใช้ Forbidden Siren 2 Europe/PAL SCES-53851 ต้นฉบับ 5,844,074,496 ไบต์');
  const digest=await hashBlob(source,progress);
  if(digest!==RELEASE.sourceSha256) fail('ISO ไม่ตรงกับฉบับที่รองรับ ต้องใช้ Europe/PAL SCES-53851 ต้นฉบับที่ยังไม่ลงแพตช์');
  return digest;
}
export function validateManifest(manifest) {
  if(manifest.format!=='SIREN2_VCDIFF_1' || manifest.version!==RELEASE.version ||
    manifest.sourceSize!==RELEASE.sourceSize || manifest.targetSize!==RELEASE.targetSize ||
    manifest.sourceSha256!==RELEASE.sourceSha256 || manifest.targetSha256!==RELEASE.targetSha256 ||
    !Array.isArray(manifest.parts) || !manifest.parts.length || manifest.parts.length>64) fail('ข้อมูลแพตช์ไม่ตรงกับ Forbidden Siren 2 v1.0');
  if(manifest.assetBase!==undefined && !/^https:\/\/raw\.githubusercontent\.com\/thiwazar\/Plaegamekao\/[a-f0-9]{40}\/siren2-v1\/$/.test(manifest.assetBase))fail('ตำแหน่งดาวน์โหลดแพตช์ไม่ถูกต้อง');
  let total=0;
  for(const part of manifest.parts){
    if(!/^patch-\d{3}\.dat$/.test(part.url) || !Number.isSafeInteger(part.size) || part.size<=0 || part.size>25*1024*1024 || !/^[a-f0-9]{64}$/.test(part.sha256)) fail('ข้อมูลส่วนดาวน์โหลดไม่ถูกต้อง');
    total+=part.size;
  }
  if(total!==manifest.patchSize || total>512*1024*1024 || !/^[a-f0-9]{64}$/.test(manifest.patchSha256))fail('ขนาดแพตช์ไม่ถูกต้อง');
}
export async function loadPatch(manifest,baseUrl,progress=()=>{},fetcher=fetch) {
  validateManifest(manifest);
  const joined=new Uint8Array(manifest.patchSize);let offset=0;const totalHash=new Sha256();
  for(const part of manifest.parts){
    const response=await fetcher(new URL(part.url,manifest.assetBase||baseUrl));
    if(!response.ok)fail(`ดาวน์โหลดแพตช์ไม่สำเร็จ (${response.status})`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length!==part.size || new Sha256().update(bytes).hex()!==part.sha256)fail('ไฟล์แพตช์เสียหาย กรุณาโหลดหน้าเว็บใหม่แล้วลองอีกครั้ง');
    joined.set(bytes,offset);totalHash.update(bytes);offset+=bytes.length;progress(offset/manifest.patchSize);
  }
  if(totalHash.hex()!==manifest.patchSha256)fail('SHA-256 ของแพตช์ไม่ตรง');
  return joined;
}
export async function applyToWriter(source,patch,writer,progress=()=>{},activity=()=>{}) {
  const hash=new Sha256();let size=0,windows=0;
  for await(const window of decodeWindows(source,patch,RELEASE.targetSize,(phase,bytes)=>activity(phase,bytes/RELEASE.targetSize))){
    activity('ตรวจข้อมูล ISO ภาษาไทย',size/RELEASE.targetSize);
    hash.update(window.bytes);
    // Smaller writes keep disk progress observable and bound each pending write.
    for(let offset=0;offset<window.bytes.length;offset+=1024*1024){
      const chunk=window.bytes.subarray(offset,offset+1024*1024);
      activity('เขียน ISO ภาษาไทยลงไดรฟ์',size/RELEASE.targetSize);
      await writer.write(chunk);size+=chunk.length;progress(size/RELEASE.targetSize);
    }
    windows++;
  }
  const digest=hash.hex();
  if(size!==RELEASE.targetSize || digest!==RELEASE.targetSha256)fail('ISO ภาษาไทยไม่ผ่านการตรวจสอบ ผลลัพธ์ยังไม่ถูกบันทึก กรุณาลองใหม่');
  return {size,sha256:digest,windows};
}
