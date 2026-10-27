import {Sha256,hashBlob} from '../dragons-crown/dragon-sha256.mjs';

const shaBytes=bytes=>new Sha256().update(bytes).hex();
const validInt=n=>Number.isSafeInteger(n)&&n>=0;
function cancelled(signal){if(signal?.aborted)throw new DOMException('ยกเลิกแล้ว','AbortError');}

export async function applyHexyzPatch(source,{baseUrl=new URL('./',import.meta.url),progress=()=>{},log=()=>{},signal,fetchImpl=globalThis.fetch,hashFile=hashBlob}={}){
 const get=async path=>{cancelled(signal);const r=await fetchImpl(new URL(path,baseUrl),{signal,cache:'no-store'});if(!r.ok)throw Error(`โหลดข้อมูลแพตช์ไม่สำเร็จ (${r.status})`);return r;};
 const manifest=await (await get('manifest.json')).json();
 if(manifest.format!=='HFWEB1'||manifest.version!==1)throw Error('ข้อมูลแพตช์ไม่ใช่รุ่นที่รองรับ');
 for(const k of ['sourceSize','targetSize','commandCount','literalPoolSize'])if(!validInt(manifest[k]))throw Error('ข้อมูลขนาดแพตช์ไม่ถูกต้อง');
 if(!Array.isArray(manifest.parts)||!manifest.parts.length)throw Error('ข้อมูลชิ้นส่วนแพตช์ไม่ครบ');
 if(source.size!==manifest.sourceSize)throw Error('ขนาด ISO ไม่ตรงกับ Hexyz Force Undub v1.2b ที่รองรับ');
 log('กำลังตรวจสอบ ISO ต้นฉบับ...');progress(2);
 const sourceHash=await hashFile(source,p=>{cancelled(signal);progress(2+p*25);});
 if(sourceHash!==manifest.sourceSha256)throw Error('ISO ไม่ตรงรุ่น ต้องใช้ Hexyz Force Undub v1.2b ตาม SHA-256 ที่ระบุ');
 log('ISO ต้นฉบับถูกต้อง กำลังโหลดและตรวจสอบแพตช์...');
 const commandBytes=new Uint8Array(await (await get(manifest.commandsUrl)).arrayBuffer());
 if(commandBytes.length!==manifest.commandCount*13||shaBytes(commandBytes)!==manifest.commandsSha256)throw Error('ตารางแพตช์เสียหาย');
 const chunks=[];let literalSize=0;
 for(let i=0;i<manifest.parts.length;i++){
  const part=manifest.parts[i];if(!validInt(part.size)||!validInt(part.rawSize)||part.rawSize>8*1024*1024)throw Error('ขนาดชิ้นส่วนแพตช์ไม่ถูกต้อง');
  let bytes=new Uint8Array(await (await get(part.url)).arrayBuffer());
  if(bytes.length!==part.size||shaBytes(bytes)!==part.sha256)throw Error(`ชิ้นส่วนแพตช์ ${i+1} เสียหาย กรุณาลองใหม่`);
  if(part.codec==='deflate'){
   const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  }else if(part.codec!=='raw')throw Error('รูปแบบชิ้นส่วนแพตช์ไม่ถูกต้อง');
  if(bytes.length!==part.rawSize||shaBytes(bytes)!==part.rawSha256)throw Error(`ถอดข้อมูลชิ้นส่วน ${i+1} ไม่สำเร็จ`);
  chunks.push(new Blob([bytes]));literalSize+=bytes.length;progress(28+(i+1)/manifest.parts.length*27);
 }
 if(literalSize!==manifest.literalPoolSize)throw Error('ข้อมูลแพตช์มาไม่ครบ');
 const literals=new Blob(chunks);const commands=new DataView(commandBytes.buffer,commandBytes.byteOffset,commandBytes.byteLength);const pieces=[];let total=0;
 for(let i=0;i<manifest.commandCount;i++){
  cancelled(signal);const pos=i*13;const opcode=commands.getUint8(pos);const offset=Number(commands.getBigUint64(pos+1,true));const size=commands.getUint32(pos+9,true);
  if(!validInt(offset)||!size||total+size>manifest.targetSize)throw Error('ตำแหน่งแพตช์ไม่ถูกต้อง');
  const input=opcode===0?source:opcode===1?literals:null;
  if(!input||offset+size>input.size)throw Error('แพตช์อ้างถึงข้อมูลนอกขอบเขต');
  pieces.push(input.slice(offset,offset+size));total+=size;
 }
 if(total!==manifest.targetSize)throw Error('ขนาด ISO ภาษาไทยไม่ถูกต้อง');
 const output=new Blob(pieces,{type:'application/octet-stream'});
 log('กำลังตรวจสอบ ISO ภาษาไทยก่อนเปิดให้ดาวน์โหลด...');
 const result=await hashFile(output,p=>{cancelled(signal);progress(55+p*45);});
 if(result!==manifest.targetSha256)throw Error('ผลลัพธ์ไม่ตรงกับรุ่นภาษาไทยที่ตรวจสอบไว้ จึงยกเลิกการดาวน์โหลด');
 log('ตรวจสอบผ่าน พร้อมดาวน์โหลด ISO ภาษาไทย');progress(100);
 return {blob:output,name:manifest.outName,sha256:result,manifest};
}
