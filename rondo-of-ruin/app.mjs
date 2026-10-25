const input=document.querySelector('#rom'),button=document.querySelector('#apply'),status=document.querySelector('#status'),drop=document.querySelector('#drop'),download=document.querySelector('#download'),cancel=document.querySelector('#cancel'),fileWarning=document.querySelector('#file-warning');
const fileMode=location.protocol==='file:';
if(fileMode){button.disabled=true;input.disabled=true;fileWarning.hidden=false;status.textContent='เปิดหน้านี้ผ่าน file:// จึงใช้ Worker ไม่ได้';}
let selected=null,manifest=null,patch=null,worker=null,url=null;
function report(text,kind=''){status.textContent=text;status.className=kind;}
function clearDownload(){download.hidden=true;if(url){URL.revokeObjectURL(url);url=null;}}
function finish(){worker?.terminate();worker=null;button.disabled=!selected||!patch;input.disabled=false;cancel.hidden=true;}
function choose(file){if(worker)return;clearDownload();selected=null;button.disabled=true;if(!file)return;
  if(!/\.nds$/i.test(file.name)){report('เลือกไฟล์ .nds โดยตรง หากเป็น ZIP ให้แตกไฟล์ก่อน','error');return;}
  if(file.size!==134217728){report('ขนาด ROM ไม่ตรง ต้องเป็น Rondo of Ruin v1.1.0 (Rondo of Blood Richter) (USA) ต้นฉบับ 134,217,728 ไบต์ (128 MiB)','error');return;}
  selected=file;document.querySelector('#filename').textContent=file.name;button.disabled=!patch;report(patch?'เลือกไฟล์แล้ว กดสร้าง ROM ภาษาไทยเพื่อตรวจและแปะแพตช์':'เลือกไฟล์แล้ว กำลังโหลดแพตช์…');
}
input.addEventListener('change',()=>choose(input.files[0]));
for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();if(!worker)drop.classList.add('drag');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag');});
drop.addEventListener('drop',e=>{if(e.dataTransfer.files.length!==1){report('เลือก ROM ครั้งละหนึ่งไฟล์','error');return;}choose(e.dataTransfer.files[0]);});
cancel.addEventListener('click',()=>{finish();report('ยกเลิกแล้ว เลือกไฟล์และเริ่มใหม่ได้');});
button.addEventListener('click',()=>{
  if(fileMode){fileWarning.hidden=false;return;}
  if(!selected||!patch||worker)return;clearDownload();button.disabled=true;input.disabled=true;cancel.hidden=false;report('กำลังอ่าน ROM ภายในอุปกรณ์…');
  try {
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(data.type==='progress')report(data.text);
      else if(data.type==='error'){report(data.text,'error');finish();}
      else if(data.type==='done'){
        url=URL.createObjectURL(new Blob([data.buffer],{type:'application/octet-stream'}));download.href=url;download.download=manifest.outputName;download.hidden=false;
        report('สร้าง ROM ภาษาไทยสำเร็จ ตรวจ SHA-256 ผ่านแล้ว กดดาวน์โหลดด้านล่าง','success');finish();download.focus();
      }
    };
    worker.onerror=()=>{report('ทำงานไม่สำเร็จ ลองโหลดหน้าใหม่หรือใช้ Chrome / Edge รุ่นปัจจุบัน','error');finish();};
    worker.postMessage({file:selected,patch,manifest});
  }catch(error){report(error.message,'error');finish();}
});
if(!fileMode)try{
  const response=await fetch('./manifest.json');if(!response.ok)throw new Error('โหลดข้อมูลแพตช์ไม่ได้ กรุณาโหลดหน้าใหม่');manifest=await response.json();
  document.querySelector('#source-hash').textContent=manifest.sourceSha256;document.querySelector('#target-hash').textContent=manifest.targetSha256;
  const result=await fetch(new URL(manifest.patch,import.meta.url));if(!result.ok)throw new Error('โหลดแพตช์ไม่ได้ กรุณาโหลดหน้าใหม่');patch=await result.arrayBuffer();
  if(patch.byteLength!==manifest.patchSize||await (async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',patch)),b=>b.toString(16).padStart(2,'0')).join(''))()!==manifest.patchSha256)throw new Error('ไฟล์แพตช์ไม่ครบหรือไม่ผ่านการตรวจ กรุณาโหลดหน้าใหม่');
  button.disabled=!selected;report('พร้อมใช้งาน เลือก ROM Rondo of Ruin v1.1.0 (Rondo of Blood Richter) (USA) ต้นฉบับ .nds');
}catch(error){patch=null;report(error.message,'error');}
