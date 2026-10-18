import {RELEASE} from './core.mjs?v=stall-fix-1';
const choose=document.querySelector('#choose'),start=document.querySelector('#start'),status=document.querySelector('#status'),progress=document.querySelector('#progress'),selected=document.querySelector('#selected');
let sourceHandle,file,worker;
const supported=Boolean(window.showOpenFilePicker&&window.showSaveFilePicker&&window.Worker);
if(!supported){choose.disabled=true;status.textContent='กรุณาเปิดหน้านี้ด้วย Chrome หรือ Edge บนคอมพิวเตอร์เพื่อแปะแพตช์บนเว็บ';}
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
    worker=new Worker(new URL('./worker.mjs?v=stall-fix-1',import.meta.url),{type:'module'});
    let lastUpdate=Date.now(),lastPhase='เริ่มทำงาน',lastValue=0;
    const watchdog=setInterval(()=>{
      const seconds=Math.floor((Date.now()-lastUpdate)/1000);
      if(seconds>=15)status.textContent=`${lastPhase} · ${lastValue.toFixed(1)}% · รอ ${seconds} วินาที${seconds>=120?' — ยังไม่มีความคืบหน้า ตรวจพื้นที่ว่างและการเชื่อมต่อไดรฟ์ หากจะลองใหม่ให้ปิดแท็บนี้ก่อน':''}`;
    },1000);
    const finish=()=>{clearInterval(watchdog);choose.disabled=false;start.disabled=false;worker.terminate();worker=null;};
    worker.onmessage=({data})=>{
      if(data.type==='progress'){lastUpdate=Date.now();lastPhase=data.phase;lastValue=data.value;progress.value=data.value;status.textContent=`${data.phase} · ${data.value.toFixed(1)}%`;}
      else if(data.type==='done'){progress.value=100;status.className='ok';status.textContent='สำเร็จ! บันทึก Forbidden_Siren_2_Thai_v1.0.iso แล้ว เปิดเกมใหม่และเลือก English ในเกม';finish();}
      else{status.className='error';status.textContent=data.message;finish();}
    };
    worker.onerror=()=>{status.className='error';status.textContent='ตัวแปะแพตช์หยุดทำงาน กรุณาปิดแท็บอื่นแล้วลองอีกครั้ง';finish();};
    worker.postMessage({file,sourceHandle,outputHandle});
  }catch(e){if(e.name!=='AbortError'){status.className='error';status.textContent=e.message;}}
});
