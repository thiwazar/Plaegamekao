import {RELEASE} from './core.mjs?v=android-1';
import {MOBILE_LOCK,checkMobileSpace,clearMobileOutput,getMobileOutput} from './mobile-storage.mjs?v=android-1';
const $=id=>document.querySelector('#'+id);
const choose=$('choose'),start=$('start'),status=$('status'),progress=$('progress'),selected=$('selected');
const input=$('mobile-input'),download=$('download'),clear=$('clear-mobile'),note=$('mobile-note');
let sourceHandle,file,worker,objectUrl,ready=false,busy=false,wakeLock;
const desktop=Boolean(window.showOpenFilePicker&&window.showSaveFilePicker);
const supported=Boolean(window.Worker&&(desktop||(navigator.storage?.getDirectory&&navigator.locks)));
note.hidden=desktop;clear.hidden=desktop;
const error=e=>{status.className='error';status.textContent=e.message||String(e);};
function buttons(){choose.disabled=!supported||busy||ready;start.disabled=!supported||busy||ready||file?.size!==RELEASE.sourceSize;clear.disabled=busy||!supported;}
function selectFile(value){file=value;selected.textContent=`${file.name} · ${(file.size/1024**3).toFixed(2)} GB`;status.className='';status.textContent=file.size===RELEASE.sourceSize?'พร้อมตรวจไฟล์ต้นฉบับและลงแพตช์':'ขนาดไฟล์ไม่ตรงกับ Europe/PAL SCES-53851 ที่รองรับ';buttons();}
async function showDownload(){
  const output=await getMobileOutput();if(!output)return false;
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(output);download.href=objectUrl;download.download=RELEASE.outName;download.hidden=false;ready=true;progress.value=100;
  status.className='ok';status.textContent='สร้างและตรวจ ISO สำเร็จแล้ว กดดาวน์โหลด ISO ภาษาไทย และรอให้ดาวน์โหลดเสร็จก่อนล้างไฟล์ชั่วคราว';buttons();return true;
}
async function locked(task){return navigator.locks.request(MOBILE_LOCK,{ifAvailable:true},async lock=>{if(!lock)throw Error('อีกแท็บกำลังใช้ไฟล์แพตช์นี้ กรุณาปิดแท็บนั้นก่อน');return task();});}
choose.addEventListener('click',async()=>{
  if(!desktop){input.value='';input.click();return;}
  try{[sourceHandle]=await showOpenFilePicker({multiple:false,types:[{description:'PlayStation 2 ISO',accept:{'application/octet-stream':['.iso']}}]});selectFile(await sourceHandle.getFile());}catch(e){if(e.name!=='AbortError')error(e);}
});
input.addEventListener('change',()=>{if(input.files[0])selectFile(input.files[0]);});
download.addEventListener('click',()=>{status.textContent='ส่งไฟล์ให้เบราว์เซอร์ดาวน์โหลดแล้ว ตรวจในรายการดาวน์โหลด อย่าล้างไฟล์ชั่วคราวจนกว่าจะดาวน์โหลดเสร็จ';});
clear.addEventListener('click',async()=>{
  if(busy)return;
  try{await locked(async()=>{await clearMobileOutput();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;download.hidden=true;download.removeAttribute('href');ready=false;status.className='';status.textContent='ล้างไฟล์ชั่วคราวแล้ว ไฟล์ที่ดาวน์โหลดเสร็จและ ISO ต้นฉบับยังอยู่';buttons();});}catch(e){error(e);}
});
async function run(outputHandle){
  busy=true;buttons();progress.value=0;status.className='';status.textContent='กำลังเริ่มทำงาน';let watchdog;
  try{
    try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}
    await new Promise((resolve,reject)=>{
      worker=new Worker(new URL('./worker.mjs?v=android-1',import.meta.url),{type:'module'});
      let lastUpdate=Date.now(),phase='เริ่มทำงาน',value=0;
      watchdog=setInterval(()=>{const seconds=Math.floor((Date.now()-lastUpdate)/1000);if(seconds>=15)status.textContent=`${phase} · ${value.toFixed(1)}% · รอ ${seconds} วินาที${seconds>=120?' — ยังไม่มีความคืบหน้า ตรวจพื้นที่ว่างและอินเทอร์เน็ต หากจะลองใหม่ให้ปิดแท็บนี้ก่อน':''}`;},1000);
      worker.onmessage=({data})=>{if(data.type==='progress'){lastUpdate=Date.now();phase=data.phase;value=data.value;progress.value=value;status.textContent=`${phase} · ${value.toFixed(1)}%`;}else if(data.type==='done')resolve();else reject(Error(data.message));};
      worker.onerror=()=>reject(Error('ตัวแปะแพตช์หยุดทำงาน กรุณาปิดแท็บอื่นแล้วลองอีกครั้ง'));
      worker.postMessage({file,sourceHandle,outputHandle,mobile:!desktop});
    });
    clearInterval(watchdog);
    if(!desktop){if(!await showDownload())throw Error('ไม่พบไฟล์ผลลัพธ์ที่ตรวจผ่าน กรุณาลองใหม่');}
    else{progress.value=100;status.className='ok';status.textContent='สำเร็จ! บันทึก Forbidden_Siren_2_Thai_v1.0.iso แล้ว เปิดเกมใหม่และเลือก English ในเกม';}
  }finally{clearInterval(watchdog);worker?.terminate();worker=null;await wakeLock?.release().catch(()=>{});wakeLock=null;busy=false;buttons();}
}
start.addEventListener('click',async()=>{
  if(start.disabled||busy)return;
  try{
    if(desktop){const output=await showSaveFilePicker({suggestedName:RELEASE.outName,types:[{description:'ISO ภาษาไทย',accept:{'application/octet-stream':['.iso']}}]});if(await sourceHandle.isSameEntry(output))throw Error('เลือกไฟล์ปลายทางคนละไฟล์กับ ISO ต้นฉบับ');await run(output);}
    else await locked(async()=>{if(await showDownload())return;await checkMobileSpace();await run();});
  }catch(e){if(e.name!=='AbortError')error(e);}
});
document.addEventListener('visibilitychange',async()=>{if(busy&&document.visibilityState==='visible'&&(!wakeLock||wakeLock.released))try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}});
buttons();
if(!supported){status.textContent='เบราว์เซอร์นี้ไม่รองรับ กรุณาใช้ Chrome รุ่นล่าสุดบน Android หรือ Chrome/Edge บนคอมพิวเตอร์';}
else if(!desktop)locked(showDownload).catch(error);
