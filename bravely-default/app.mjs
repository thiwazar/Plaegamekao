import {applyPatch} from './patcher.mjs';
const $=id=>document.getElementById(id);let busy=false,url;
$('rom').onchange=()=>{if(url){URL.revokeObjectURL(url);url=null;}$('download').hidden=true;$('log').textContent='';$('progress').value=0;};
$('patch').onclick=async()=>{
 if(busy)return;const file=$('rom').files[0];if(!file){$('log').textContent='กรุณาเลือกไฟล์ .3ds ต้นฉบับก่อน';return;}
 busy=true;$('patch').disabled=true;$('rom').disabled=true;$('download').hidden=true;$('log').textContent='';
 if(url){URL.revokeObjectURL(url);url=null;}$('progress').hidden=false;$('progress').value=0;
 try{
  const r=await fetch(new URL('manifest.json',import.meta.url),{cache:'no-cache'});if(!r.ok)throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ');const m=await r.json();
  const result=await applyPatch(file,m,p=>{$('progress').value=p;$('percent').textContent=p+'%';},t=>{$('log').textContent+=t+'\n';});
  url=URL.createObjectURL(result);$('download').href=url;$('download').download=m.outName;$('download').hidden=false;
 }catch(e){$('log').textContent+='ไม่สำเร็จ: '+e.message+'\n';}finally{busy=false;$('patch').disabled=false;$('rom').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});

