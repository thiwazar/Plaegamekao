import {applyPatch} from './patcher.mjs';
const $=id=>document.getElementById(id);let busy=false,url;
$('patch').onclick=async()=>{
 if(busy)return;const file=$('rom').files[0];if(!file){$('log').textContent='กรุณาเลือกไฟล์ .3ds ต้นฉบับก่อน';return;}
 busy=true;$('patch').disabled=true;$('rom').disabled=true;$('download').hidden=true;$('log').textContent='';
 if(url){URL.revokeObjectURL(url);url=null;}$('progress').hidden=false;$('progress').value=0;
 try{
  const r=await fetch('manifest.json',{cache:'no-cache'});if(!r.ok)throw Error('โหลดข้อมูลเวอร์ชันไม่สำเร็จ');const m=await r.json();
  const result=await applyPatch(file,m,p=>{$('progress').value=p;$('percent').textContent=p+'%';},text=>{$('log').textContent+=text+'\n';});
  url=URL.createObjectURL(result);$('download').href=url;$('download').download=m.outName;$('download').hidden=false;
 }catch(e){$('log').textContent+='ไม่สำเร็จ: '+e.message+'\n';}finally{busy=false;$('patch').disabled=false;$('rom').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
