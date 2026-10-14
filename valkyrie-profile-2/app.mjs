const $ = (id) => document.getElementById(id);
const input = $('iso');
const drop = $('drop');
const button = $('apply');
const status = $('status');
const bar = $('bar');
const worker = new Worker(new URL('./worker.mjs?v=20261014-1', import.meta.url), {type: 'module'});
let manifest;
let data;
let selectedFile;
let jobs = 0;

function report(message, kind) {
  status.textContent = message;
  status.className = kind || '';
}

function progress(value) {
  bar.hidden = value === null;
  if (value !== null) bar.value = value;
}

function hashBlob(blob, onProgress) {
  const id = ++jobs;
  return new Promise((resolve, reject) => {
    const listener = ({data: message}) => {
      if (message.id !== id) return;
      if (message.progress !== undefined) onProgress(message.progress);
      if (message.hash || message.error) {
        worker.removeEventListener('message', listener);
        message.error ? reject(new Error(message.error)) : resolve(message.hash);
      }
    };
    worker.addEventListener('message', listener);
    worker.postMessage({id, blob});
  });
}

async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
}

function choose(file) {
  selectedFile = file || null;
  button.disabled = !selectedFile || !data;
  if (selectedFile) report('เลือกไฟล์ ' + selectedFile.name + ' แล้ว กดปุ่มเพื่อตรวจและสร้างไฟล์ภาษาไทย');
}

input.addEventListener('change', () => choose(input.files[0]));
drop.addEventListener('click', (event) => { if (event.target !== input) input.click(); });
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('drag');
  if (!input.disabled) choose(event.dataTransfer.files[0]);
});

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

function buildTarget(file) {
  const pieces = [];
  let size = 0;
  for (const [kind, at, length] of manifest.ops) {
    if (!(length > 0)) throw new Error('ข้อมูลแพตช์เสียหาย');
    if (kind === 's') {
      if (at + length > file.size) throw new Error('ช่วงข้อมูลในแพตช์ไม่ถูกต้อง');
      pieces.push(file.slice(at, at + length));
    } else if (kind === 'd') {
      if (at + length > data.length) throw new Error('ช่วงข้อมูลในแพตช์ไม่ถูกต้อง');
      pieces.push(data.subarray(at, at + length));
    } else {
      throw new Error('ข้อมูลแพตช์เสียหาย');
    }
    size += length;
  }
  if (size !== manifest.targetSize) throw new Error('ขนาดไฟล์ผลลัพธ์ไม่ถูกต้อง');
  return new Blob(pieces, {type: 'application/octet-stream'});
}

button.addEventListener('click', async () => {
  if (!selectedFile || !data) return;
  button.disabled = true;
  input.disabled = true;
  try {
    if (selectedFile.size !== manifest.sourceSize) {
      throw new Error('ขนาด ISO ไม่ตรงกับ Valkyrie Profile 2: Silmeria (USA) SLUS-21452 ที่รองรับ');
    }
    report('ขั้นที่ 1/2 กำลังตรวจ SHA-256 ของ ISO ต้นฉบับ… (ใช้เวลาหลายนาที)');
    const sourceHash = await hashBlob(selectedFile, progress);
    if (sourceHash !== manifest.sourceSha256) {
      throw new Error('ISO นี้ไม่ตรงกับต้นฉบับที่รองรับ กรุณาใช้ Valkyrie Profile 2: Silmeria (USA) SLUS-21452 ที่ยังไม่ดัดแปลง');
    }
    const output = buildTarget(selectedFile);
    report('ขั้นที่ 2/2 กำลังตรวจ SHA-256 ของไฟล์ภาษาไทย…');
    const targetHash = await hashBlob(output, progress);
    if (targetHash !== manifest.targetSha256) throw new Error('ไฟล์ที่สร้างไม่ผ่าน SHA-256 กรุณาอย่านำไปใช้');
    progress(null);
    download(manifest.outName, output);
    report('สำเร็จ ตรวจ SHA-256 ผ่านแล้ว เริ่มดาวน์โหลด ' + manifest.outName + ' (ประมาณ 6.1 GB) แล้ว', 'success');
  } catch (error) {
    progress(null);
    report(error.message || 'เกิดข้อผิดพลาดระหว่างสร้างแพตช์', 'error');
  } finally {
    input.disabled = false;
    button.disabled = !selectedFile || !data;
  }
});

try {
  if (!('DecompressionStream' in window)) throw new Error('เบราว์เซอร์นี้ไม่รองรับการถอดแพตช์ กรุณาใช้ Chrome หรือ Edge รุ่นปัจจุบันบนคอมพิวเตอร์');
  const response = await fetch('./manifest.json?v=20261014-1', {cache: 'no-store'});
  if (!response.ok) throw new Error('โหลดข้อมูลแพตช์ไม่ได้ (' + response.status + ')');
  manifest = await response.json();
  if (manifest.format !== 'VP2COPY1') throw new Error('รูปแบบแพตช์ไม่ถูกต้อง');
  const chunks = [];
  for (const part of manifest.parts) {
    const partResponse = await fetch('./' + part.url, {cache: 'no-store'});
    if (!partResponse.ok) throw new Error('โหลดไฟล์แพตช์ไม่ได้ (' + partResponse.status + ')');
    const packed = new Uint8Array(await partResponse.arrayBuffer());
    if (packed.length !== part.gzSize || await sha256(packed) !== part.gzSha256) throw new Error('ไฟล์แพตช์ที่ดาวน์โหลดมาไม่ผ่านการตรวจสอบ');
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const raw = new Uint8Array(await new Response(stream).arrayBuffer());
    if (raw.length !== part.size || await sha256(raw) !== part.sha256) throw new Error('ไฟล์แพตช์ที่ถอดแล้วไม่ผ่านการตรวจสอบ');
    chunks.push(raw);
  }
  data = new Uint8Array(manifest.dataSize);
  let at = 0;
  for (const chunk of chunks) { data.set(chunk, at); at += chunk.length; }
  if (at !== manifest.dataSize) throw new Error('ขนาดข้อมูลแพตช์ไม่ถูกต้อง');
  button.disabled = !selectedFile;
  report('แพตช์พร้อมใช้งาน เลือกไฟล์ ISO Valkyrie Profile 2: Silmeria (USA) ของคุณ');
} catch (error) {
  report(error.message || 'โหลดแพตช์ไม่สำเร็จ', 'error');
}
