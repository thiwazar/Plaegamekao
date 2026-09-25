export function setupVagrant(g){
  const el=id=>document.getElementById(id+'-'+g.id);
  const drop=el('drop'),input=el('file'),log=el('log'),bar=el('bar'),download=el('dl');
  const cancel=document.createElement('button');cancel.className='btn cancel-patch';cancel.type='button';cancel.textContent='ยกเลิก';cancel.style.display='none';download.after(cancel);
  const cue=document.createElement('a');cue.className='btn';cue.textContent='ดาวน์โหลด CUE สำหรับเปิดเกม';cue.href='patches/Vagrant_Story_Thai_Preview_V9.cue';cue.download='Vagrant_Story_Thai_Preview_V9.cue';download.after(cue);
  const note=document.createElement('p');note.className='fontfix-note';note.textContent='เตรียมพื้นที่ว่าง 1 GB • ดาวน์โหลด BIN และ CUE ไว้โฟลเดอร์เดียวกันโดยไม่เปลี่ยนชื่อ แล้วเปิดเกมผ่าน CUE • เก็บต้นฉบับไว้';drop.after(note);
  input.accept='.bin';drop.tabIndex=0;drop.setAttribute('role','button');drop.setAttribute('aria-label','เลือก BIN ของ Vagrant Story USA');
  log.setAttribute('role','log');log.setAttribute('aria-live','polite');
  bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
  let worker=null,url=null,busy=false,sourceFile=null,generation=0;
  const line=(text,cls='')=>{log.style.display='block';const div=document.createElement('div');div.textContent=text;div.className=cls;log.append(div);log.scrollTop=log.scrollHeight;};
  const progress=(n,label)=>{bar.style.display='block';bar.firstElementChild.style.width=n+'%';bar.setAttribute('aria-valuenow',String(n));bar.setAttribute('aria-label',label);};
  const busyState=value=>{busy=value;input.disabled=value;drop.setAttribute('aria-disabled',String(value));drop.classList.toggle('is-busy',value);cancel.style.display=value?'inline-block':'none';};
  async function release(){if(worker){worker.terminate();worker=null;}if(url){URL.revokeObjectURL(url);url=null;}sourceFile=null;}
  async function handleFile(file){
    if(busy){line('กำลังทำงานอยู่ หากต้องการเปลี่ยนไฟล์ ให้กดยกเลิกก่อน');return;}
    const thisJob=++generation;
    busyState(true);download.style.display='none';cue.style.display='none';log.replaceChildren();progress(0,'กำลังเริ่ม');
    await release();if(thisJob!==generation)return;sourceFile=file;
    line('ไฟล์ที่เลือก: '+file.name+' ('+(file.size/1024/1024).toFixed(1)+' MB)');
    if(!window.isSecureContext){line('กรุณาเปิดผ่าน HTTPS หรือ localhost เพื่อใช้ตัวแพตช์','err');busyState(false);return;}
    try{
      const current=new Worker(new URL('./vagrant-worker.mjs',import.meta.url),{type:'module'});worker=current;
      const failure=async message=>{if(worker!==current)return;line(message,'err');await release();busyState(false);};
      current.onerror=event=>{event.preventDefault();failure('โหลดตัวแพตช์ไม่สำเร็จ กรุณารีโหลดหน้าเว็บ และตรวจว่าอัปโหลดไฟล์ JavaScript ครบ');};
      current.onmessage=({data})=>{
        if(worker!==current)return;
        if(data.type==='log')line(data.message);
        else if(data.type==='progress')progress(data.value,data.phase);
        else if(data.type==='source')drop.dataset.detectedSource=data.name;
        else if(data.type==='error')failure(data.message);
        else if(data.type==='complete'){
          current.terminate();worker=null;
          url=URL.createObjectURL(data.file);download.style.display='inline-block';cue.style.display='inline-block';download.textContent='ดาวน์โหลด BIN ภาษาไทย V9';
          download.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=g.outName;document.body.append(a);a.click();a.remove();};
          progress(100,'ไฟล์พร้อมดาวน์โหลด');busyState(false);input.value='';
          line('V9 Preview: ยังไม่ใช่ไทยครบทั้งเกม และยังไม่ได้ทดสอบ V9 ในอีมูเลเตอร์','fontfix-warning');
        }
      };
      current.postMessage({type:'start',file:sourceFile});
    }catch(error){line(error.message,'err');await release();busyState(false);}
  }
  cancel.onclick=async()=>{if(!busy)return;cancel.disabled=true;generation++;await release();busyState(false);cancel.disabled=false;download.style.display='none';progress(0,'ยกเลิกแล้ว');line('ยกเลิกแล้ว ไฟล์ต้นฉบับไม่ได้ถูกแก้ไข');input.value='';};
  drop.onclick=e=>{if(e.target!==input&&!busy)input.click();};
  drop.onkeydown=e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!busy)input.click();}};
  drop.ondragover=e=>{e.preventDefault();if(!busy)drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);};
  input.onchange=()=>{if(input.files[0])handleFile(input.files[0]);};
  window.addEventListener('pagehide',()=>{release();});
}
