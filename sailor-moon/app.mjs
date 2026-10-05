import {patchRom,prepareSource} from './core.mjs';
const $ = id => document.getElementById(id);
let manifest, busy=false, blobUrl;
function status(text, error=false) { $('status').textContent=text; $('status').className=error?'error':''; }
async function run(file) {
  if (busy || !manifest) return;
  busy=true; $('file').disabled=true; $('download').hidden=true;
  if(blobUrl) {URL.revokeObjectURL(blobUrl);blobUrl=null;}
  try {
    status('กำลังตรวจไฟล์ต้นฉบับและแปะแพทช์…');
    if(!manifest.sources.some(s=>[s.size,s.size+512].includes(file.size))) throw new Error('ขนาด ROM ไม่ตรงกับรุ่นที่รองรับ');
    const source=await file.arrayBuffer();
    const detected=await prepareSource(source,manifest);
    status('พบต้นฉบับ: '+detected.source.name+'\nกำลังแปะแพทช์…');
    const response=await fetch(detected.source.patchUrl);
    if(!response.ok) throw new Error('โหลดแพทช์ไม่สำเร็จ กรุณาลองใหม่');
    const {output,headerRemoved}=await patchRom(source,await response.arrayBuffer(),manifest);
    blobUrl=URL.createObjectURL(new Blob([output],{type:'application/octet-stream'}));
    $('download').href=blobUrl; $('download').download=manifest.outputName; $('download').hidden=false;
    status('แปะแพทช์สำเร็จ ✓ ตรวจ SHA-256 ผลลัพธ์ตรงกับ v1.0 แล้ว'+(headerRemoved?' (นำ copier header 512 ไบต์ออกแล้ว)':''));
  } catch(error) {status(error.message,true);}
  finally {busy=false; $('file').disabled=false;}
}
$('file').addEventListener('change',e=>{if(e.target.files[0])run(e.target.files[0]);});
$('drop').addEventListener('dragover',e=>e.preventDefault());
$('drop').addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer.files[0])run(e.dataTransfer.files[0]);});
try {
  const response=await fetch('./manifest.json');if(!response.ok)throw new Error('โหลดข้อมูลแพทช์ไม่สำเร็จ');
  manifest=await response.json();
  $('source-name').textContent=manifest.sources.map(s=>s.name+' ('+s.size/1048576+' MB)').join(' หรือ ');
  $('source-sha').textContent=manifest.sources.map(s=>s.name+'\n'+s.sha256).join('\n\n');
  $('target-sha').textContent=manifest.targetSha256;
  for(const source of manifest.sources) {
    const a=document.createElement('a');a.href=source.patchUrl;a.download=source.patchUrl;
    a.textContent='ดาวน์โหลด IPS สำหรับ '+source.id;
    const p=document.createElement('p');p.append(a);$('patch-links').append(p);
  }
  $('file').disabled=false;status('พร้อมใช้งาน เลือก ROM ต้นฉบับเพื่อเริ่ม');
} catch(error) {status(error.message,true);}
