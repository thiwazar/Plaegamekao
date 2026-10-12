import {applyPatch, sha256} from './patch-core.mjs';
const $ = id => document.getElementById(id);
const input = $('rom'), drop = $('drop'), button = $('apply'), status = $('status');
let manifest, patch, selected, busy = false, urls = [];
function report(text, kind = '') { status.textContent = text; status.className = kind; }
function choose(file) {
  if (busy) return;
  selected = file; button.disabled = !file || !patch;
  $('downloads').hidden = true;
  for (const url of urls) URL.revokeObjectURL(url); urls = [];
  if (file) report('เลือก ' + file.name + ' แล้ว พร้อมสร้างไฟล์ภาษาไทย');
}
input.addEventListener('change', () => choose(input.files[0]));
drop.addEventListener('click', e => { if (!busy && e.target !== input) input.click(); });
drop.addEventListener('dragover', e => { e.preventDefault(); if (!busy) drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); choose(e.dataTransfer.files[0]); });
button.addEventListener('click', async () => {
  if (busy || !selected || !patch) return;
  busy = true; button.disabled = true; input.disabled = true;
  try {
    if (selected.size !== manifest.sourceSize) throw new Error('ขนาด BIN ต้องเป็น 503,158,656 ไบต์ จากแผ่นญี่ปุ่น SLPS 018.70 ต้นฉบับ');
    if (!globalThis.DecompressionStream) throw new Error('กรุณาใช้ Chrome หรือ Edge รุ่นปัจจุบัน');
    report('กำลังอ่าน BIN…');
    const source = new Uint8Array(await selected.arrayBuffer());
    const output = await applyPatch(source, patch, manifest, report);
    const [binName, cueName] = manifest.outputFiles;
    const cue = `FILE "${binName}" BINARY\r\n  TRACK 01 MODE2/2352\r\n    INDEX 01 00:00:00\r\n`;
    for (const [id, name, blob] of [['download-bin', binName, new Blob([output], {type:'application/octet-stream'})], ['download-cue', cueName, new Blob([cue], {type:'text/plain'})]]) {
      const url = URL.createObjectURL(blob); urls.push(url); $(id).href = url; $(id).download = name;
    }
    $('downloads').hidden = false;
    report('สำเร็จ ตรวจ SHA-256 ผ่านแล้ว กดดาวน์โหลด BIN และ CUE ด้านล่าง เก็บทั้งสองไฟล์ไว้ด้วยกันแล้วเปิด CUE', 'success');
  } catch (e) { report(e.message || 'สร้างแพตช์ไม่สำเร็จ', 'error'); }
  finally { busy = false; button.disabled = !selected || !patch; input.disabled = false; }
});
try {
  const response = await fetch('./manifest.json', {cache:'no-store'});
  if (!response.ok) throw new Error('โหลดข้อมูลแพตช์ไม่ได้');
  manifest = await response.json();
  const r = await fetch('./' + manifest.patch);
  if (!r.ok) throw new Error('โหลดไฟล์แพตช์ไม่ได้');
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length !== manifest.patchSize || await sha256(bytes) !== manifest.patchSha256) throw new Error('ไฟล์แพตช์ดาวน์โหลดไม่ครบหรือเสียหาย');
  patch = bytes; button.disabled = !selected;
  report('แพตช์ v1.0 พร้อมใช้งาน เลือก BIN ญี่ปุ่น SLPS 018.70 ต้นฉบับ');
} catch (e) { report(e.message, 'error'); }
