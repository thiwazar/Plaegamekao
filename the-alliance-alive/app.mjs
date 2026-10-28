const expected='76f6e6ec12219bde08c04dbbb11840ecc3f5e45c032ddf18b8f09117ec441593';
const button=document.getElementById('make-luma');
const link=document.getElementById('download');
const status=document.getElementById('status');
let url;
button.addEventListener('click',async()=>{
  button.disabled=true;link.hidden=true;status.textContent='กำลังเตรียมชุด Luma…';
  if(url){URL.revokeObjectURL(url);url=null;}
  try{
    const response=await fetch('luma-data.bin',{cache:'no-store'});
    if(!response.ok)throw Error(`โหลดข้อมูลแพตช์ไม่ได้ (${response.status})`);
    const bytes=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==expected)throw Error('ข้อมูลแพตช์ไม่ตรงรุ่น');
    url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
    link.href=url;link.download='AllianceAlive_Thai_v1.0_Luma.zip';link.hidden=false;
    status.textContent='ตรวจชุด Luma ผ่านแล้ว กดดาวน์โหลดและติดตั้งตามขั้นตอนด้านบน';
  }catch(error){status.textContent=`ไม่สำเร็จ: ${error.message}`;}
  finally{button.disabled=false;}
});
