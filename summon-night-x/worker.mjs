import { applyBps, sha256 } from '../yoko-of-sorrow/core.mjs';

self.onmessage = async ({ data: { file, manifest } }) => {
  try {
    const source = new Uint8Array(await file.arrayBuffer());
    if (source.length !== manifest.sourceSize ||
        String.fromCharCode(...source.subarray(12, 16)) !== 'CS7J' ||
        await sha256(source) !== manifest.sourceSha256) {
      throw new Error('ไฟล์ไม่ตรงกับ ROM รุ่น English v0.951 รหัส CS7J ที่รองรับ');
    }
    const response = await fetch('payload.dat');
    if (!response.ok) throw new Error('โหลดข้อมูลแพตช์ไม่ได้ กรุณาลองอีกครั้ง');
    const patch = new Uint8Array(await response.arrayBuffer());
    if (patch.length !== manifest.patchSize || await sha256(patch) !== manifest.patchSha256) {
      throw new Error('ข้อมูลแพตช์ไม่ผ่านการตรวจสอบ กรุณาโหลดหน้าใหม่');
    }
    self.postMessage({ type: 'progress', text: 'กำลังสร้างและตรวจ ROM ภาษาไทย…' });
    const output = applyBps(source, patch, manifest.targetSize);
    if (await sha256(output) !== manifest.targetSha256) throw new Error('ผลลัพธ์ไม่ผ่านการตรวจสอบ');
    self.postMessage({ type: 'done', buffer: output.buffer }, [output.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', text: error.message });
  }
};
