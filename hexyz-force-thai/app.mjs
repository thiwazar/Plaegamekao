import {applyHexyzPatch} from './patcher.mjs';
const $=id=>document.getElementById(id);let controller=null,url=null;
function status(text,kind=''){$('status').textContent=text;$('status').className=kind;}
function clearDownload(){if(url)URL.revokeObjectURL(url);url=null;$('download').hidden=true;$('download').removeAttribute('href');}
$('source').addEventListener('change',()=>{clearDownload();$('filename').textContent=$('source').files[0]?.name||'ยังไม่ได้เลือกไฟล์';$('apply').disabled=!$('source').files.length;status('');$('progress').hidden=true;});
$('cancel').addEventListener('click',()=>controller?.abort());
$('apply').addEventListener('click',async()=>{
 const file=$('source').files[0];if(!file||controller)return;clearDownload();controller=new AbortController();$('source').disabled=true;$('apply').disabled=true;$('cancel').hidden=false;$('progress').hidden=false;$('progress').value=0;
 try{
  const result=await applyHexyzPatch(file,{signal:controller.signal,progress:p=>$('progress').value=p,log:text=>status(text)});
  url=URL.createObjectURL(result.blob);$('download').href=url;$('download').download=result.name;$('download').hidden=false;status('เสร็จแล้ว พร้อมดาวน์โหลด ISO ภาษาไทย','success');
 }catch(error){clearDownload();status(error.name==='AbortError'?'ยกเลิกแล้ว':error.message,'error');}
 finally{controller=null;$('source').disabled=false;$('apply').disabled=!$('source').files.length;$('cancel').hidden=true;}
});
try{
 const release=await (await fetch('./release.json',{cache:'no-store'})).json();$('version').textContent=release.displayVersion;$('release-date').textContent=`อัปเดต: ${new Date(release.date).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}`;$('release-note').textContent=release.notes.join('\n');
 const manifest=await (await fetch('./manifest.json',{cache:'no-store'})).json();$('hashes').textContent=`ต้นฉบับ SHA-256: ${manifest.sourceSha256}\nISO ไทย SHA-256: ${manifest.targetSha256}`;
}catch{ $('release-note').textContent='ไม่สามารถโหลดรายละเอียดรุ่น กรุณาโหลดหน้าใหม่ก่อนใช้งาน'; }
