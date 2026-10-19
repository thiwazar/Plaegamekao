const fileInput=document.getElementById('source-iso');
const startButton=document.getElementById('start-patch');
const cancelButton=document.getElementById('cancel-patch');
const selected=document.getElementById('selected-file');
const progressBar=document.getElementById('patch-progress');
const log=document.getElementById('patch-log');
let worker=null,writable=null,busy=false;

function line(message,error=false){
  const row=document.createElement('div');row.textContent=message;
  if(error)row.className='error';log.append(row);log.scrollTop=log.scrollHeight;
}
function setBusy(value){busy=value;fileInput.disabled=value;startButton.disabled=value||!fileInput.files.length;cancelButton.hidden=!value;}
async function abortOutput(){
  if(worker){worker.terminate();worker=null;}
  if(writable){try{await writable.abort();}catch{}writable=null;}
  setBusy(false);
}

fileInput.addEventListener('change',()=>{
  const file=fileInput.files[0];selected.textContent=file?file.name+' ('+(file.size/1024/1024/1024).toFixed(2)+' GB)':'ยังไม่ได้เลือกไฟล์';
  startButton.disabled=!file;
});
cancelButton.addEventListener('click',async()=>{if(!busy)return;await abortOutput();line('ยกเลิกแล้ว ISO ต้นฉบับไม่ถูกแก้ไข');});
window.addEventListener('pagehide',()=>{if(worker)worker.terminate();if(writable)writable.abort().catch(()=>{});});

startButton.addEventListener('click',async()=>{
  if(busy)return;
  const file=fileInput.files[0];if(!file)return;
  log.replaceChildren();progressBar.value=0;
  if(!window.isSecureContext||typeof window.showSaveFilePicker!=='function'){
    line('กรุณาเปิดหน้านี้ด้วย Chrome หรือ Edge รุ่นที่รองรับการบันทึกไฟล์ขนาดใหญ่ผ่าน HTTPS',true);return;
  }
  let handle;
  try{
    handle=await window.showSaveFilePicker({suggestedName:'TOD2_Thai_Beta_v1.iso',types:[{description:'PlayStation 2 ISO',accept:{'application/octet-stream':['.iso']}}]});
  }catch(error){if(error.name!=='AbortError')line('เลือกที่บันทึกไม่สำเร็จ: '+error.message,true);return;}
  if(handle.name.toLowerCase()===file.name.toLowerCase()){line('ห้ามเลือกชื่อไฟล์เดียวกับ ISO ต้นฉบับ กรุณาเลือกชื่อใหม่เพื่อไม่ให้เขียนทับ',true);return;}
  try{
    writable=await handle.createWritable();setBusy(true);
    const current=new Worker(new URL('./tod2-worker.mjs',import.meta.url),{type:'module'});worker=current;
    current.onerror=async event=>{event.preventDefault();if(worker!==current)return;line('ตัวแพตช์ในเบราว์เซอร์ทำงานผิดพลาด',true);await abortOutput();};
    current.onmessage=async({data})=>{
      if(worker!==current)return;
      if(data.type==='log')line(data.message);
      else if(data.type==='progress')progressBar.value=data.value;
      else if(data.type==='chunk'){
        try{await writable.write(data.bytes);if(worker===current)current.postMessage({type:'ack'});}
        catch(error){line('เขียนไฟล์ผลลัพธ์ไม่สำเร็จ: '+error.message,true);await abortOutput();}
      }else if(data.type==='error'){line(data.message,true);await abortOutput();}
      else if(data.type==='complete'){
        try{await writable.close();writable=null;current.terminate();worker=null;setBusy(false);progressBar.value=100;
          line('เสร็จแล้ว: '+handle.name+' — SHA-256 '+data.sha256);
          line('ยังเป็นรุ่นเบต้า ชื่อในหน้าต่อสู้/บางเมนูอาจเพี้ยน และยังไม่ได้ทดสอบเล่นครบทั้งเกม');
        }catch(error){line('ปิดไฟล์ผลลัพธ์ไม่สำเร็จ: '+error.message,true);await abortOutput();}
      }
    };
    current.postMessage({type:'start',file});
  }catch(error){line('เริ่มแพตช์ไม่สำเร็จ: '+error.message,true);await abortOutput();}
});
