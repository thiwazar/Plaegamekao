const $ = (id) => document.getElementById(id);
const input = $('rom');
const drop = $('drop');
const button = $('apply');
const status = $('status');
let manifest;
let patchBytes;
let selectedFile;

function report(message, kind) {
  status.textContent = message;
  status.className = kind || '';
}

function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

function choose(file) {
  selectedFile = file || null;
  button.disabled = !selectedFile || !patchBytes;
  if (selectedFile) report('เลือกไฟล์ ' + selectedFile.name + ' แล้ว พร้อมตรวจและสร้างไฟล์ภาษาไทย');
}

input.addEventListener('change', () => choose(input.files[0]));
drop.addEventListener('click', (event) => {
  if (event.target !== input) input.click();
});
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  drop.classList.remove('drag');
  choose(event.dataTransfer.files[0]);
});

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

button.addEventListener('click', async () => {
  if (!selectedFile || !patchBytes || !manifest) return;
  button.disabled = true;
  try {
    if (selectedFile.size !== manifest.sourceSize) {
      throw new Error('ขนาด BIN ไม่ตรงกับแผ่นญี่ปุ่น SLPM 861.43 ที่รองรับ');
    }
    report('กำลังอ่าน BIN และตรวจ SHA-256…');
    const source = new Uint8Array(await selectedFile.arrayBuffer());
    if (await sha256(source) !== manifest.sourceSha256) {
      throw new Error('BIN นี้ไม่ตรงกับแผ่นต้นฉบับที่รองรับ กรุณาใช้ Monster Race ญี่ปุ่น SLPM 861.43 ที่ยังไม่ดัดแปลง');
    }

    const view = new DataView(patchBytes.buffer, patchBytes.byteOffset, patchBytes.byteLength);
    const magic = new TextDecoder('ascii').decode(patchBytes.subarray(0, 9));
    if (magic !== 'MRSPARSE1' || patchBytes.length < 93) throw new Error('ไฟล์แพตช์ไม่ถูกต้อง');
    const sourceSize = Number(view.getBigUint64(9, true));
    const targetSize = Number(view.getBigUint64(17, true));
    const recordCount = view.getUint32(25, true);
    const patchSourceSha = hex(patchBytes.subarray(29, 61));
    const patchTargetSha = hex(patchBytes.subarray(61, 93));
    if (sourceSize !== manifest.sourceSize || targetSize !== manifest.targetSize ||
        patchSourceSha !== manifest.sourceSha256 || patchTargetSha !== manifest.targetSha256) {
      throw new Error('ข้อมูลในแพตช์ไม่ตรงกับรุ่น v1.0');
    }

    report('กำลังถอดแพตช์และปรับ BIN ในเครื่องนี้…');
    if (!('DecompressionStream' in window)) throw new Error('เบราว์เซอร์นี้ไม่รองรับการถอดแพตช์ กรุณาใช้ Chrome หรือ Edge รุ่นปัจจุบัน');
    const compressed = new Blob([patchBytes.subarray(93)]).stream();
    const recordsBuffer = await new Response(compressed.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
    const records = new Uint8Array(recordsBuffer);
    const recordsView = new DataView(records.buffer);
    let cursor = 0;
    let previousEnd = 0;
    for (let index = 0; index < recordCount; index++) {
      if (cursor + 12 > records.length) throw new Error('ข้อมูลแพตช์ขาดหรือเสียหาย');
      const offsetBig = recordsView.getBigUint64(cursor, true);
      const length = recordsView.getUint32(cursor + 8, true);
      cursor += 12;
      if (offsetBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('ตำแหน่งข้อมูลในแพตช์เกินขอบเขต');
      const offset = Number(offsetBig);
      if (!length || offset < previousEnd || offset + length > source.length || cursor + length > records.length) {
        throw new Error('ตำแหน่งข้อมูลในแพตช์ไม่ถูกต้อง');
      }
      source.set(records.subarray(cursor, cursor + length), offset);
      cursor += length;
      previousEnd = offset + length;
    }
    if (cursor !== records.length) throw new Error('พบข้อมูลส่วนเกินในแพตช์');

    report('กำลังตรวจ SHA-256 ของไฟล์ไทย…');
    if (source.length !== manifest.targetSize || await sha256(source) !== manifest.targetSha256) {
      throw new Error('ไฟล์ที่สร้างไม่ผ่าน SHA-256 กรุณาอย่านำไปใช้');
    }

    const binName = 'Monster_Race_Thai_v1.0.bin';
    const cueName = 'Monster_Race_Thai_v1.0.cue';
    const cue = 'FILE "' + binName + '" BINARY\r\n  TRACK 01 MODE2/2352\r\n    INDEX 01 00:00:00\r\n';
    download(binName, new Blob([source], {type: 'application/octet-stream'}));
    setTimeout(() => download(cueName, new Blob([cue], {type: 'application/octet-stream'})), 350);
    report('สำเร็จ ตรวจ SHA-256 ผ่านแล้ว ดาวน์โหลด BIN และ CUE แล้ว วางไว้โฟลเดอร์เดียวกันก่อนเปิด CUE', 'success');
  } catch (error) {
    report(error.message || 'เกิดข้อผิดพลาดระหว่างสร้างแพตช์', 'error');
  } finally {
    button.disabled = !selectedFile || !patchBytes;
  }
});

try {
  const response = await fetch('./manifest.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('โหลดข้อมูลแพตช์ไม่ได้ (' + response.status + ')');
  manifest = await response.json();
  const patchResponse = await fetch('./' + manifest.patch, {cache: 'no-store'});
  if (!patchResponse.ok) throw new Error('โหลดไฟล์แพตช์ไม่ได้ (' + patchResponse.status + ')');
  patchBytes = new Uint8Array(await patchResponse.arrayBuffer());
  if (patchBytes.length !== manifest.patchSize || await sha256(patchBytes) !== manifest.patchSha256) {
    throw new Error('ไฟล์แพตช์ที่ดาวน์โหลดมาไม่ผ่านการตรวจสอบ');
  }
  button.disabled = !selectedFile;
  report('แพตช์ v1.0 พร้อมใช้งาน เลือก BIN แผ่นญี่ปุ่น SLPM 861.43 ของคุณ');
} catch (error) {
  report(error.message || 'โหลดแพตช์ไม่สำเร็จ', 'error');
}

