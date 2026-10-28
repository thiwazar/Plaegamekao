const input=document.querySelector('#rom'),button=document.querySelector('#apply'),log=document.querySelector('#log'),progress=document.querySelector('#progress'),download=document.querySelector('#download');
let url=null,busy=false;
function reset(){download.hidden=true;if(url){URL.revokeObjectURL(url);url=null;}log.hidden=true;log.textContent='';progress.hidden=true;progress.value=0;}
input.addEventListener('change',()=>{if(busy)return;reset();button.disabled=!input.files.length;});
button.addEventListener('click',()=>{
  const file=input.files[0];if(!file||busy)return;
  reset();busy=true;button.disabled=true;input.disabled=true;log.hidden=false;progress.hidden=false;
  const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  const finish=()=>{worker.terminate();busy=false;input.disabled=false;button.disabled=!input.files.length;};
  worker.onmessage=({data})=>{
    if(data.error){log.textContent+='ผิดพลาด: '+data.error+'\n';finish();return;}
    if(data.done){url=URL.createObjectURL(data.blob);download.href=url;download.download=data.name;download.hidden=false;progress.value=100;log.textContent+='ตรวจแฮชต้นฉบับและผลลัพธ์ผ่าน — แปะแพตช์สำเร็จ พร้อมดาวน์โหลด\n';finish();return;}
    progress.value=data.value;log.textContent+=data.message+'\n';
  };
  worker.onerror=()=>{log.textContent+='เกิดข้อผิดพลาดในตัวประมวลผล กรุณารีเฟรชหน้าแล้วลองใหม่\n';finish();};
  worker.postMessage({file});
});
window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
