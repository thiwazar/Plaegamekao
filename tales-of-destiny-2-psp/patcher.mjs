import {Sha256,hashBlob} from '../dragons-crown/dragon-sha256.mjs';
export async function applyPatch(source,{progress=()=>{},log=()=>{},fetchImpl=fetch,baseUrl=new URL('./',import.meta.url)}={}){
 const get=async n=>{const r=await fetchImpl(new URL(n,baseUrl));if(!r.ok)throw Error('โหลดแพตช์ไม่สำเร็จ: '+r.status);return r;};
 const m=await(await get('manifest.json')).json();
 if(m.format!=='TOD2BLK1'||source.size!==m.sourceSize)throw Error('ต้องใช้ ISO English v0.3.8 ขนาด 2,027,954,176 ไบต์');
 log('ตรวจ SHA-256 ต้นฉบับ…');
 if(await hashBlob(source,p=>progress(p*25))!==m.sourceSha256)throw Error('ISO ไม่ตรงรุ่น English v0.3.8 ที่รองรับ');
 log('โหลดและตรวจข้อมูลแพตช์…');
 const b=new Uint8Array(await(await get('payload.bin')).arrayBuffer());
 if(b.length!==m.patchSize||new Sha256().update(b).hex()!==m.patchSha256)throw Error('ข้อมูลแพตช์เสียหาย');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);let p=8;
 const need=n=>{if(p+n>b.length)throw Error('แพตช์ไม่ครบ');};
 if(new TextDecoder().decode(b.subarray(0,8))!=='TOD2BLK1')throw Error('รูปแบบแพตช์ไม่ถูกต้อง');
 need(4);const hn=v.getUint32(p,true);p+=4;need(hn);
 const h=JSON.parse(new TextDecoder().decode(b.subarray(p,p+hn)));p+=hn;
 if(h.source_sha256!==m.sourceSha256||h.target_sha256!==m.targetSha256||h.source_size!==m.sourceSize||h.target_size!==m.targetSize)throw Error('ข้อมูลรุ่นไม่ตรงกัน');
 const pieces=[];let total=0,ended=false;log('กำลังประกอบ ISO ภาษาไทย…');
 while(p<b.length){need(1);const op=b[p++];if(op===0){ended=true;break;}let part;
  if(op===1){need(16);const at=Number(v.getBigUint64(p,true)),n=Number(v.getBigUint64(p+8,true));p+=16;if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||n<=0||at<0||at+n>source.size)throw Error('ตัวชี้นอกไฟล์');part=source.slice(at,at+n);}
  else if(op===2){need(8);const n=v.getUint32(p,true),c=v.getUint32(p+4,true);p+=8;need(c);if(n>4194304||c>5242880)throw Error('ข้อมูลใหญ่เกินขอบเขต');const raw=new Uint8Array(await new Response(new Blob([b.subarray(p,p+c)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());p+=c;if(raw.length!==n)throw Error('ถอดข้อมูลไม่ครบ');part=new Blob([raw]);}
  else throw Error('คำสั่งแพตช์ไม่ถูกต้อง');
  total+=part.size;if(total>m.targetSize)throw Error('ผลลัพธ์ใหญ่เกินกำหนด');pieces.push(part);if(pieces.length%1000===0)progress(25+total/m.targetSize*30);
 }
 if(!ended||p!==b.length||total!==m.targetSize)throw Error('ขนาดผลลัพธ์ไม่ตรง');
 const blob=new Blob(pieces,{type:'application/octet-stream'});log('ตรวจ SHA-256 ผลลัพธ์…');
 const sha256=await hashBlob(blob,p=>progress(55+p*45));if(sha256!==m.targetSha256)throw Error('ผลลัพธ์ตรวจไม่ผ่าน จึงยังไม่เปิดให้บันทึก');
 progress(100);return {blob,name:m.outName,sha256};
}
