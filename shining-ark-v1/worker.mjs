import '../vendor/sha256.umd.min.js';
import { decodeWindows } from './vcdiff.mjs';
import { PATCH } from './config.mjs';

const send = (type, data = {}) => self.postMessage({ type, ...data });
const progress = (value, phase) => send('progress', { value, phase });
const log = message => send('log', { message });

async function digest(file) {
  const hash = await self.hashwasm.createSHA256();
  hash.init();
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    hash.update(new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
    progress(Math.floor(Math.min(offset + chunkSize, file.size) / file.size * 25), 'กำลังตรวจ ISO ต้นฉบับ');
  }
  return hash.digest('hex');
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'start') return;
  try {
    const file = data.file;
    if (!file || !/\.iso$/i.test(file.name)) throw new Error('กรุณาเลือกไฟล์ ISO ของ Shining Ark');
    if (file.size !== PATCH.sourceSize) throw new Error('ขนาดไฟล์ไม่ตรงกับ ISO ต้นฉบับ Shining Ark รหัส NPJH50717 (1,549,983,744 ไบต์)');

    log('กำลังตรวจ SHA-256 ของไฟล์ในเครื่อง — ไม่มีการอัปโหลด ISO');
    const sourceHash = await digest(file);
    if (sourceHash === PATCH.targetSha256) {
      log('ไฟล์นี้เป็น Shining Ark ภาษาไทย V1 อยู่แล้ว');
      send('complete', { file, alreadyPatched: true });
      return;
    }
    if (sourceHash !== PATCH.sourceSha256) throw new Error('ไฟล์ไม่ตรงกับ ISO ที่รองรับ (NPJH50717) — SHA-256 ที่ตรวจพบ: ' + sourceHash);

    const outputHash = await self.hashwasm.createSHA256();
    outputHash.init();
    const outputParts = [];
    let writtenBefore = 0;
    const patchTotal = PATCH.parts.reduce((sum, part) => sum + part.size, 0);
    log('ตรวจไฟล์ต้นฉบับผ่าน กำลังโหลดแพตช์รวมประมาณ ' + (patchTotal / 1024 / 1024).toFixed(1) + ' MB');

    for (let index = 0; index < PATCH.parts.length; index++) {
      const part = PATCH.parts[index];
      log('โหลดและตรวจแพตช์ส่วน ' + (index + 1) + '/' + PATCH.parts.length);
      const response = await fetch(new URL(part.url, import.meta.url));
      if (!response.ok) throw new Error('โหลดแพตช์ส่วน ' + (index + 1) + ' ไม่สำเร็จ (' + response.status + ')');
      const patchBytes = new Uint8Array(await response.arrayBuffer());
      if (patchBytes.length !== part.size || await self.hashwasm.sha256(patchBytes) !== part.sha256) {
        throw new Error('แพตช์ส่วน ' + (index + 1) + ' เสียหายหรือโหลดไม่ครบ กรุณาลองใหม่');
      }

      let partWritten = 0;
      for await (const window of decodeWindows(file, patchBytes, part.targetSize)) {
        outputHash.update(window.bytes);
        outputParts.push(...window.parts);
        partWritten = window.written;
        progress(25 + Math.floor((writtenBefore + partWritten) / PATCH.targetSize * 74), 'กำลังสร้าง ISO ภาษาไทย V1');
      }
      writtenBefore += partWritten;
      if (partWritten !== part.targetSize) throw new Error('ขนาดผลลัพธ์แพตช์ส่วน ' + (index + 1) + ' ไม่ตรง');
    }

    if (writtenBefore !== PATCH.targetSize || outputHash.digest('hex') !== PATCH.targetSha256) {
      throw new Error('ผลลัพธ์ไม่ตรงกับ ISO ภาษาไทย V1 ระบบยกเลิกไฟล์ที่สร้าง');
    }
    const output = new Blob(outputParts, { type: 'application/octet-stream' });
    if (output.size !== PATCH.targetSize) throw new Error('ขนาด ISO ผลลัพธ์ไม่ครบ');
    log('ตรวจ ISO ภาษาไทย V1 ผ่านครบทั้งขนาดและ SHA-256');
    send('complete', { file: output });
  } catch (error) {
    send('error', { message: error.message });
  }
};
