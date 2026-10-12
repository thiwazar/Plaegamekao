export function setupShiningArk(g) {
  const el = id => document.getElementById(id + '-' + g.id);
  const drop = el('drop'), input = el('file'), log = el('log'), bar = el('bar'), download = el('dl');
  const cancel = document.createElement('button');
  cancel.className = 'btn cancel-patch'; cancel.type = 'button'; cancel.textContent = 'ยกเลิก'; cancel.style.display = 'none'; download.after(cancel);
  const note = document.createElement('p');
  note.className = 'fontfix-note';
  note.textContent = 'ใช้พื้นที่ว่างอย่างน้อย 4 GB • แพตช์จะดาวน์โหลดประมาณ 191 MB • ISO ประมวลผลในเครื่องและไม่ถูกอัปโหลด';
  drop.after(note);
  input.accept = '.iso'; drop.tabIndex = 0; drop.setAttribute('role', 'button'); drop.setAttribute('aria-label', 'เลือก ISO ของ Shining Ark รหัส NPJH50717');
  log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100');

  let worker = null, url = null, busy = false, generation = 0;
  const line = (text, cls = '') => { log.style.display = 'block'; const div = document.createElement('div'); div.textContent = text; div.className = cls; log.append(div); log.scrollTop = log.scrollHeight; };
  const progress = (value, label) => { bar.style.display = 'block'; bar.firstElementChild.style.width = value + '%'; bar.setAttribute('aria-valuenow', String(value)); bar.setAttribute('aria-label', label); };
  const busyState = value => { busy = value; input.disabled = value; drop.setAttribute('aria-disabled', String(value)); drop.classList.toggle('is-busy', value); cancel.style.display = value ? 'inline-block' : 'none'; };
  const release = () => { if (worker) { worker.terminate(); worker = null; } if (url) { URL.revokeObjectURL(url); url = null; } };

  async function handleFile(file) {
    if (busy) return;
    const job = ++generation;
    busyState(true); download.style.display = 'none'; log.replaceChildren(); progress(0, 'กำลังเริ่ม');
    release();
    line('ไฟล์ที่เลือก: ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)');
    if (!window.isSecureContext) { line('กรุณาเปิดหน้าเว็บผ่าน HTTPS เพื่อใช้ตัวแพตช์', 'err'); busyState(false); return; }
    try {
      const current = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); worker = current;
      const fail = message => { if (worker !== current) return; line(message, 'err'); release(); busyState(false); };
      current.onerror = event => { event.preventDefault(); fail('โหลดตัวแพตช์ไม่สำเร็จ กรุณารีโหลดหน้าเว็บและลองใหม่'); };
      current.onmessage = ({ data }) => {
        if (worker !== current || job !== generation) return;
        if (data.type === 'log') line(data.message);
        else if (data.type === 'progress') progress(data.value, data.phase);
        else if (data.type === 'error') fail(data.message);
        else if (data.type === 'complete') {
          current.terminate(); worker = null;
          url = URL.createObjectURL(data.file);
          download.style.display = 'inline-block'; download.textContent = 'ดาวน์โหลด ISO ภาษาไทย V1';
          download.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = g.outName; document.body.append(a); a.click(); a.remove(); };
          progress(100, 'ไฟล์พร้อมดาวน์โหลด'); busyState(false); input.value = '';
          line(data.alreadyPatched ? 'ไฟล์นี้เป็นฉบับภาษาไทย V1 อยู่แล้ว' : 'สร้าง ISO ภาษาไทย V1 และตรวจ SHA-256 ผ่านแล้ว');
        }
      };
      current.postMessage({ type: 'start', file });
    } catch (error) { line(error.message, 'err'); release(); busyState(false); }
  }

  cancel.onclick = () => { if (!busy) return; generation++; release(); busyState(false); download.style.display = 'none'; progress(0, 'ยกเลิกแล้ว'); line('ยกเลิกแล้ว ไฟล์ต้นฉบับไม่ได้ถูกแก้ไข'); input.value = ''; };
  drop.onclick = event => { if (event.target !== input && !busy) input.click(); };
  drop.onkeydown = event => { if (event.target === drop && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (!busy) input.click(); } };
  drop.ondragover = event => { event.preventDefault(); if (!busy) drop.classList.add('drag'); };
  drop.ondragleave = () => drop.classList.remove('drag');
  drop.ondrop = event => { event.preventDefault(); drop.classList.remove('drag'); if (event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]); };
  input.onchange = () => { if (input.files[0]) handleFile(input.files[0]); };
  window.addEventListener('pagehide', release);
}
