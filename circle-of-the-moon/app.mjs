const SOURCE_SHA = 'f2a7d5dca15d5a0f11cc4135517b5ddb4d76d522bac6f40b38b76439dafd2292';
const TARGET_SHA = '4b514d8f7e2f1868c45def4c277b5b5cd91ba7930a5de514b59470936da06d73';
const ROM_SIZE = 8388608;
const $ = id => document.getElementById(id);
const input = $('rom'), button = $('apply'), status = $('status'), drop = $('drop');
$('source-hash').textContent = SOURCE_SHA;
$('target-hash').textContent = TARGET_SHA;
let patch;
let selectedFile;

function report(message, kind = '') {
  status.textContent = message;
  status.className = kind;
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function applyIps(source, ips) {
  const marker = new TextDecoder('ascii').decode(ips.subarray(0, 5));
  if (marker !== 'PATCH') throw new Error('ไฟล์แพตช์ไม่ถูกต้อง');
  const output = source.slice();
  let cursor = 5;
  while (cursor + 3 <= ips.length) {
    if (ips[cursor] === 69 && ips[cursor + 1] === 79 && ips[cursor + 2] === 70) {
      if (cursor + 3 !== ips.length) throw new Error('ข้อมูลท้ายแพตช์ไม่ถูกต้อง');
      return output;
    }
    if (cursor + 5 > ips.length) break;
    const offset = (ips[cursor] << 16) | (ips[cursor + 1] << 8) | ips[cursor + 2];
    const size = (ips[cursor + 3] << 8) | ips[cursor + 4];
    cursor += 5;
    if (size) {
      if (cursor + size > ips.length || offset + size > output.length) break;
      output.set(ips.subarray(cursor, cursor + size), offset);
      cursor += size;
    } else {
      if (cursor + 3 > ips.length) break;
      const run = (ips[cursor] << 8) | ips[cursor + 1];
      if (offset + run > output.length) break;
      output.fill(ips[cursor + 2], offset, offset + run);
      cursor += 3;
    }
  }
  throw new Error('ไฟล์แพตช์เสียหรือไม่ครบ');
}

function choose(file) {
  selectedFile = file;
  button.disabled = !file || !patch;
  if (file) report(`เลือก ${file.name} แล้ว กดสร้างไฟล์ภาษาไทยได้เลย`);
}

input.addEventListener('change', () => choose(input.files[0]));
drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('drag'); choose(event.dataTransfer.files[0]); });
button.addEventListener('click', async () => {
  if (!selectedFile || !patch) return;
  button.disabled = true;
  try {
    if (selectedFile.size !== ROM_SIZE) throw new Error('ขนาด ROM ต้องเป็น 8 MB');
    report('กำลังตรวจ ROM ต้นฉบับ…');
    const source = new Uint8Array(await selectedFile.arrayBuffer());
    if (String.fromCharCode(...source.subarray(0xAC, 0xB0)) !== 'AAMP') throw new Error('ต้องใช้ ROM รุ่นยุโรป รหัส AAMP');
    if (await digest(source) !== SOURCE_SHA) throw new Error('ROM นี้ไม่ตรงกับต้นฉบับที่รองรับ กรุณาใช้รุ่นยุโรป (E) ที่ยังไม่ดัดแปลง');
    report('กำลังแปะแพตช์และตรวจผลลัพธ์…');
    const output = applyIps(source, patch);
    if (await digest(output) !== TARGET_SHA) throw new Error('ไฟล์ที่สร้างไม่ผ่านการตรวจ SHA-256');
    const url = URL.createObjectURL(new Blob([output], {type: 'application/octet-stream'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Castlevania_Circle_of_the_Moon_Thai_v1.0.gba';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    report('สร้างไฟล์ภาษาไทย v1.0 สำเร็จ และตรวจ SHA-256 ผ่าน', 'success');
  } catch (error) {
    report(error.message, 'error');
  } finally {
    button.disabled = !selectedFile || !patch;
  }
});

try {
  const response = await fetch('./CotM_Thai_v1.0_AAMP.ips');
  if (!response.ok) throw new Error(`โหลดแพตช์ไม่ได้ (${response.status})`);
  patch = new Uint8Array(await response.arrayBuffer());
  if (patch.length < 8 || new TextDecoder('ascii').decode(patch.subarray(0, 5)) !== 'PATCH') throw new Error('ไฟล์แพตช์ไม่ถูกต้อง');
  button.disabled = !selectedFile;
  report('พร้อมใช้งาน เลือก ROM ต้นฉบับ .gba');
} catch (error) {
  report(error.message, 'error');
}
