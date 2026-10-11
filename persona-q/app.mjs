import {applyQgdeltaStreaming} from './patcher.mjs';
const $=id=>document.getElementById(id);let busy=false,url;
const log=text=>{$('log').textContent+=text+'\n';};
$('patch').onclick=async()=>{
 if(busy)return;const file=$('rom').files[0];if(!file){$('log').textContent='กรุณาเลือกไฟล์ .3ds ก่อน';return;}
 busy=true;$('patch').disabled=true;$('rom').disabled=true;$('download').hidden=true;$('log').textContent='';
 if(url){URL.revokeObjectURL(url);url=null;}
 $('progress').hidden=false;$('progress').value=0;
 try{
  const response=await fetch('manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('โหลดข้อมูลรุ่นไม่สำเร็จ');const game=await response.json();
  const blob=await applyQgdeltaStreaming(file,game,p=>{$('progress').value=p;$('percent').textContent=p+'%';},log);
  url=URL.createObjectURL(blob);$('download').href=url;$('download').download=game.outName;$('download').hidden=false;
 }catch(e){log('ไม่สำเร็จ: '+e.message);}finally{busy=false;$('patch').disabled=false;$('rom').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
