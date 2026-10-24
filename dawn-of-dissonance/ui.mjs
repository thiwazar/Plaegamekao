let busy=false;
const cards=[...document.querySelectorAll('.card')];
const refresh=()=>cards.forEach(c=>{c.querySelector('button').disabled=busy||!c.querySelector('input').files.length;c.querySelector('input').disabled=busy;});
try{
 const response=await fetch('./variants.json',{cache:'no-store'});if(!response.ok)throw Error('โหลดข้อมูลเวอร์ชันไม่ได้');
 const variants=await response.json();
 for(const v of variants){
  const card=document.getElementById(v.id),input=card.querySelector('input'),button=card.querySelector('button'),status=card.querySelector('.status'),progress=card.querySelector('progress'),link=card.querySelector('.download');let url;
  input.addEventListener('change',()=>{if(url)URL.revokeObjectURL(url);link.hidden=true;progress.value=0;status.textContent=input.files.length?'พร้อมตรวจไฟล์ '+v.name:'เลือกไฟล์เกมเพื่อเริ่มต้น';refresh();});
  button.addEventListener('click',()=>{
   if(busy||!input.files.length)return;busy=true;refresh();link.hidden=true;status.textContent='กำลังเตรียมข้อมูล';
   let worker;
   const finish=()=>{worker?.terminate();busy=false;refresh();};
   try{
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{if(data.error){status.textContent=data.error;finish();}else if(data.result){if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(data.result);link.href=url;link.download=v.output;link.hidden=false;status.textContent='ตรวจไฟล์สำเร็จ พร้อมดาวน์โหลด '+v.name+' ภาษาไทย v1.0';progress.value=100;finish();}else{status.textContent=data.message;progress.value=data.progress;}};
    worker.onerror=()=>{status.textContent='ไม่สามารถประมวลผลได้ กรุณาเปิดด้วยเบราว์เซอร์รุ่นใหม่แล้วลองอีกครั้ง';finish();};
    worker.postMessage({file:input.files[0],variant:v});
   }catch(error){status.textContent=error.message;finish();}
  });
 }
}catch(error){cards.forEach(c=>c.querySelector('.status').textContent=error.message+' กรุณาโหลดหน้าใหม่');}
