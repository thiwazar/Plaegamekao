const $=id=>document.getElementById(id);
let manifest,selected=new Map(),worker=null,busy=false,url=null;
const size=n=>`${(n/1e6).toFixed(1)} MB`;
function status(text,kind=''){$('status').textContent=text;$('status').className=kind;}
function discard(){if(url)URL.revokeObjectURL(url);url=null;$('download').hidden=true;}
function setBusy(value){busy=value;$('folder').disabled=value||!manifest;$('choose-folder').disabled=value||!manifest;$('start').disabled=value||!manifest||selected.size!==manifest.sourceFiles;$('cancel').hidden=!value;}
function choose(files){if(busy||!manifest)return;discard();selected.clear();const missing=[];
 for(const entry of manifest.files.filter(e=>e.mode==='delta')){const matches=files.filter(f=>{const path=f.webkitRelativePath||f.name;return path===entry.name||path.endsWith('/'+entry.name);});if(matches.length===1)selected.set(entry.name,matches[0]);else missing.push(entry.name);}
 $('progress-box').hidden=true;$('selection').textContent=`พบไฟล์ที่ใช้ ${selected.size}/${manifest.sourceFiles} ไฟล์ · ผลลัพธ์ ${manifest.totalFiles} ไฟล์ (${size(manifest.targetBytes)})`;setBusy(false);
 if(missing.length)status(`ยังขาดไฟล์หรือพบชื่อซ้ำ: ${missing.slice(0,4).join(', ')}${missing.length>4?` และอีก ${missing.length-4} ไฟล์`:''} เลือกโฟลเดอร์ PCSG00190 ที่มี mess, sce และ sys ครบ`,'error');
 else status('พร้อมตรวจไฟล์และสร้าง rePatch ภาษาไทย v1.0');
}
$('folder').addEventListener('change',e=>choose([...e.target.files]));
$('choose-folder').onclick=()=>{if(!busy&&manifest)$('folder').click();};
function fail(message){worker?.terminate();worker=null;setBusy(false);status(message,'error');}
$('start').onclick=()=>{if(busy||!manifest||selected.size!==manifest.sourceFiles)return;discard();setBusy(true);$('progress-box').hidden=false;$('progress').value=0;$('percent').textContent='0%';status('เปิดแท็บนี้ไว้ ไฟล์เกมจะถูกอ่านในเครื่องเท่านั้น');
 try{worker=new Worker(new URL('./worker.mjs?v=1.0',import.meta.url),{type:'module'});worker.onerror=()=>fail('เครื่องมือหยุดทำงาน ลองโหลดหน้าใหม่หรือใช้ Chrome/Edge บนคอมพิวเตอร์');worker.onmessage=({data})=>{if(data.type==='progress'){$('phase').textContent=data.phase;$('progress').value=data.percent;$('percent').textContent=`${data.percent}%`;}else if(data.type==='error')fail(data.message);else if(data.type==='done'){worker.terminate();worker=null;url=URL.createObjectURL(data.output);$('download').href=url;$('download').download=manifest.outputName;$('download').hidden=false;setBusy(false);status(`สร้างและตรวจไฟล์ครบ ${manifest.totalFiles} ไฟล์แล้ว · ZIP ${size(data.output.size)}`,'success');$('download').focus();}};worker.postMessage({manifest,files:[...selected]});}catch(e){fail('เบราว์เซอร์นี้เปิดเครื่องมือไม่ได้ กรุณาใช้ Chrome หรือ Edge');}
};
$('cancel').onclick=()=>{worker?.terminate();worker=null;setBusy(false);$('progress-box').hidden=true;status('ยกเลิกแล้ว เลือกเริ่มใหม่ได้');};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
try{if(!globalThis.Worker||!globalThis.DecompressionStream)throw Error();const r=await fetch('./manifest.json',{cache:'no-cache'});if(!r.ok)throw Error();manifest=await r.json();if(manifest.schema!==1||manifest.titleId!=='PCSG00190'||manifest.version!=='1.0'||manifest.files.length!==manifest.totalFiles)throw Error();$('selection').textContent=`ใช้ต้นฉบับ ${manifest.sourceFiles} ไฟล์ · สร้างชุด rePatch ${manifest.totalFiles} ไฟล์`;setBusy(false);status('เลือกโฟลเดอร์ต้นฉบับเพื่อเริ่ม หรือดาวน์โหลด rePatch ที่เตรียมไว้ด้านบน');}catch{status('โหลดเครื่องมือไม่สำเร็จ กรุณาเปิดผ่าน HTTPS และใช้ Chrome/Edge รุ่นใหม่ หรือดาวน์โหลดชุด rePatch ด้านบน','error');}
