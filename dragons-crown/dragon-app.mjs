const $=id=>document.getElementById(id);
let manifest,file=null,worker=null,url=null,busy=false,index=0;
const completed=new Set();
function status(text,kind=''){$('status').textContent=text;$('status').className=kind;}
function discard(){if(url)URL.revokeObjectURL(url);url=null;$('download').hidden=true;$('save-tip').hidden=true;}
function controls(value){busy=value;$('archive').disabled=value;$('game-file').disabled=value;$('start').disabled=value||!file;$('cancel').hidden=!value;}
function select(){discard();index=Number($('archive').value);file=null;$('game-file').value='';$('chosen').textContent='ยังไม่ได้เลือกไฟล์';$('expected').textContent=`${manifest.files[index].name} · ต้นฉบับ ${(manifest.files[index].source_size/1e6).toFixed(1)} MB`;$('progress-row').hidden=true;controls(false);status('พร้อมรับไฟล์ต้นฉบับที่ยังไม่ลงแพตช์');}
function fail(msg){worker?.terminate();worker=null;controls(false);status(msg,'error');}
$('archive').onchange=select;
$('game-file').onchange=e=>{discard();file=e.target.files[0]||null;$('chosen').textContent=file?`${file.name} · ${(file.size/1e6).toFixed(1)} MB`:'ยังไม่ได้เลือกไฟล์';controls(false);status('พร้อมตรวจไฟล์');};
$('start').onclick=()=>{
 if(!file||busy)return;discard();controls(true);$('progress-row').hidden=false;$('progress').value=0;$('percent').textContent='0%';status('กำลังประมวลผลในเครื่องของคุณ เปิดแท็บนี้ไว้จนเสร็จ');
 try{
  worker=new Worker(new URL('./dragon-worker.mjs',import.meta.url),{type:'module'});
  worker.onerror=()=>fail('เครื่องมือหยุดทำงาน ลองปิดแท็บอื่นแล้วเริ่มใหม่');
  worker.onmessage=({data})=>{
   if(data.type==='progress'){$('phase').textContent=data.phase;$('progress').value=data.percent;$('percent').textContent=`${data.percent}%`;}
   else if(data.type==='error')fail(data.message);
   else if(data.type==='done'){
    worker.terminate();worker=null;url=URL.createObjectURL(data.output);$('download').href=url;$('download').download=data.name;$('download').textContent=`ดาวน์โหลด ${data.name}`;$('download').hidden=false;$('save-tip').hidden=false;completed.add(index);$('completed').textContent=`สร้างสำเร็จ ${completed.size} / ${manifest.files.length} ไฟล์: ${[...completed].map(i=>manifest.files[i].name).join(', ')}`;controls(false);status(`ตรวจ SHA-256 ผ่านแล้ว · ${(data.output.size/1e6).toFixed(1)} MB พร้อมดาวน์โหลด`,'success');$('download').focus();
   }
  };worker.postMessage({file,entry:manifest.files[index]});
 }catch(e){fail('เปิดเครื่องมือไม่ได้ กรุณาใช้ Chrome หรือ Edge บนคอมพิวเตอร์');}
};
$('cancel').onclick=()=>{worker?.terminate();worker=null;controls(false);$('progress-row').hidden=true;status('ยกเลิกแล้ว ไฟล์ต้นฉบับไม่ถูกแก้ไข');};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
try{
 if(!window.Worker||!window.DecompressionStream)throw Error('กรุณาใช้ Chrome หรือ Edge รุ่นปัจจุบัน');
 const r=await fetch('./dragon-manifest.json');if(!r.ok)throw Error('โหลดรายการแพตช์ไม่สำเร็จ');manifest=await r.json();if(manifest.files.length!==2)throw Error('รายการแพตช์ไม่ถูกต้อง');
 manifest.files.forEach((f,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${i+1}. ${f.name}`;$('archive').append(option);});select();
}catch(e){status(e.message,'error');}
