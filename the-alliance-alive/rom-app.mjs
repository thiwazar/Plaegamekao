import {applyPatch} from './patcher.mjs';
const $=id=>document.getElementById(id);
let busy=false,outputUrl;
$('rom').addEventListener('change',()=>{
  if(outputUrl){URL.revokeObjectURL(outputUrl);outputUrl=null;}
  $('rom-download').hidden=true;$('log').textContent='';$('progress').value=0;
});
$('patch').addEventListener('click',async()=>{
  if(busy)return;
  const file=$('rom').files[0];
  if(!file){$('log').textContent='กรุณาเลือกไฟล์ .3ds ต้นฉบับก่อน';return;}
  busy=true;$('patch').disabled=true;$('rom').disabled=true;$('rom-download').hidden=true;
  $('log').textContent='';$('progress').hidden=false;$('progress').value=0;
  if(outputUrl){URL.revokeObjectURL(outputUrl);outputUrl=null;}
  try{
    const response=await fetch(new URL('manifest.json',import.meta.url),{cache:'no-store'});
    if(!response.ok)throw Error('โหลดข้อมูลรุ่นแพตช์ไม่สำเร็จ');
    const manifest=await response.json();
    const result=await applyPatch(file,manifest,p=>{$('progress').value=p;$('percent').textContent=`${p}%`;},t=>{$('log').textContent+=t+'\n';});
    outputUrl=URL.createObjectURL(result);
    $('rom-download').href=outputUrl;$('rom-download').download=manifest.outName;$('rom-download').hidden=false;
  }catch(error){$('log').textContent+=`ไม่สำเร็จ: ${error.message}\n`;}
  finally{busy=false;$('patch').disabled=false;$('rom').disabled=false;}
});
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{if(outputUrl)URL.revokeObjectURL(outputUrl);});
