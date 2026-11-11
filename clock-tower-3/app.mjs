const input=document.querySelector('#iso'),run=document.querySelector('#patch'),cancel=document.querySelector('#cancel'),download=document.querySelector('#download'),status=document.querySelector('#status'),progress=document.querySelector('progress');
let worker,url;
function reset(){if(worker)worker.terminate();worker=null;input.disabled=false;run.disabled=!input.files.length;cancel.hidden=true;}
input.addEventListener('change',()=>{run.disabled=!input.files.length;download.hidden=true;if(url)URL.revokeObjectURL(url);url=null;status.textContent=input.files[0]?.name||'เลือก ISO ต้นฉบับเพื่อเริ่มต้น';progress.value=0;});
run.addEventListener('click',()=>{
  const file=input.files[0];if(!file)return;
  if(file.size!==3925483520){status.textContent='ขนาดไฟล์ไม่ตรง ต้องใช้ ISO USA Undub v1.0 beta ขนาด 3,925,483,520 ไบต์';return;}
  if(!globalThis.Worker||!globalThis.DecompressionStream){status.textContent='กรุณาใช้ Chrome หรือ Edge รุ่นปัจจุบันบนคอมพิวเตอร์';return;}
  download.hidden=true;run.disabled=true;input.disabled=true;cancel.hidden=false;status.textContent='กำลังเริ่มตรวจสอบ…';
  worker=new Worker('./worker.js');
  worker.onmessage=({data})=>{
    if(data.error){status.textContent=data.error;reset();}
    else if(data.output){url=URL.createObjectURL(data.output);download.href=url;download.hidden=false;status.textContent='ตรวจสอบสำเร็จ ดาวน์โหลด ISO ภาษาไทยได้แล้ว';progress.value=100;reset();}
    else{progress.value=data.percent;status.textContent=data.message+' '+data.percent+'%';}
  };
  worker.onerror=e=>{status.textContent='ทำรายการไม่สำเร็จ: '+e.message;reset();};worker.postMessage({file});
});
cancel.addEventListener('click',()=>{reset();progress.value=0;status.textContent='ยกเลิกแล้ว ไฟล์ต้นฉบับไม่ได้ถูกแก้ไข';});
window.addEventListener('pagehide',()=>{if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);});
