import {RELEASE} from './core.mjs';
const choose=document.querySelector('#choose'),start=document.querySelector('#start'),status=document.querySelector('#status'),progress=document.querySelector('#progress'),selected=document.querySelector('#selected');
let sourceHandle,file,worker;
const supported=Boolean(window.showOpenFilePicker&&window.showSaveFilePicker&&window.Worker);
if(!supported){choose.disabled=true;status.textContent='แปะบนเว็บด้วย Chrome หรือ Edge บนคอมพิวเตอร์ หรือดาวน์โหลดแพตช์ไปใช้กับ xdelta ตามคู่มือด้านล่าง';}
choose.addEventListener('click',async()=>{
  try{
    [sourceHandle]=await showOpenFilePicker({multiple:false,types:[{description:'PlayStation 2 ISO',accept:{'application/octet-stream':['.iso']}}]});file=await sourceHandle.getFile();
    selected.textContent=`${file.name} · ${(file.size/1024**3).toFixed(2)} GB`;
    start.disabled=file.size!==RELEASE.sourceSize;
    status.textContent=start.disabled?'ขนาดไฟล์ไม่ตรงกับ Europe/PAL SCES-53851 ที่รองรับ':'พร้อมตรวจไฟล์ต้นฉบับและลงแพตช์';status.className='';
  }catch(e){if(e.name!=='AbortError')status.textContent=e.message;}
});
start.addEventListener('click',async()=>{
  if(!file||start.disabled)return;
  try{
    const outputHandle=await showSaveFilePicker({suggestedName:RELEASE.outName,types:[{description:'ISO ภาษาไทย',accept:{'application/octet-stream':['.iso']}}]});
    if(await sourceHandle.isSameEntry(outputHandle))throw Error('เลือกไฟล์ปลายทางคนละไฟล์กับ ISO ต้นฉบับ');
    choose.disabled=true;start.disabled=true;progress.value=0;status.className='';
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    const finish=()=>{choose.disabled=false;start.disabled=false;worker.terminate();worker=null;};
    worker.onmessage=({data})=>{
      if(data.type==='progress'){progress.value=data.value;status.textContent=`${data.phase} · ${Math.floor(data.value)}%`;}
      else if(data.type==='done'){progress.value=100;status.className='ok';status.textContent='สำเร็จ! บันทึก Forbidden_Siren_2_Thai_v1.0.iso แล้ว เปิดเกมใหม่และเลือก English ในเกม';finish();}
      else{status.className='error';status.textContent=data.message;finish();}
    };
    worker.onerror=()=>{status.className='error';status.textContent='ตัวแปะแพตช์หยุดทำงาน กรุณาปิดแท็บอื่นแล้วลองอีกครั้ง';finish();};
    worker.postMessage({file,sourceHandle,outputHandle});
  }catch(e){if(e.name!=='AbortError'){status.className='error';status.textContent=e.message;}}
});
const download=document.querySelector('#offline');
download.addEventListener('click',async()=>{
  download.disabled=true;
  try{
    const {loadPatch}=await import('./core.mjs');const url=new URL('./manifest.json',location.href);
    const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ');
    const bytes=await loadPatch(await response.json(),url);const objectUrl=URL.createObjectURL(new Blob([bytes]));
    const a=document.createElement('a');a.href=objectUrl;a.download='Forbidden_Siren_2_Thai_v1.0.xdelta';a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
  }catch(e){status.className='error';status.textContent=e.message;}finally{download.disabled=false;}
});
