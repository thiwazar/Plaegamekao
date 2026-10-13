import {hashBlob} from '../dragons-crown/dragon-sha256.mjs';
const integer = n => Number.isSafeInteger(n) && n >= 0;
const hex = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const fail = message => { throw new Error(message); };

export function buildOutput(file, manifest, payload) {
  if (manifest.format !== 'KUONCOPY1' || !integer(manifest.sourceSize) || !integer(manifest.targetSize) ||
      file.size !== manifest.sourceSize || !Array.isArray(manifest.operations) || manifest.operations.length > 20000 ||
      !manifest.payload || payload.byteLength !== manifest.payload.decodedSize) fail('ข้อมูลแพตช์ Kuon ไม่ถูกต้อง');
  const pieces = [];
  let total = 0;
  for (const op of manifest.operations) {
    if (!Array.isArray(op)) fail('คำสั่งแพตช์ไม่ถูกต้อง');
    const kind = op[0];
    const offset = kind === 'zero' ? 0 : op[1];
    const length = kind === 'zero' ? op[1] : op[2];
    if (op.length !== (kind === 'zero' ? 2 : 3) || !integer(offset) || !integer(length) || length === 0 ||
        !integer(offset + length) || !integer(total + length) || total + length > manifest.targetSize) fail('ช่วงข้อมูลแพตช์ไม่ถูกต้อง');
    if (kind === 'copy') {
      if (offset + length > file.size) fail('ช่วงข้อมูลต้นฉบับเกินขนาดไฟล์');
      pieces.push(file.slice(offset, offset + length));
    } else if (kind === 'data') {
      if (offset + length > payload.byteLength) fail('ช่วงข้อมูลภาษาไทยเกินขนาดแพตช์');
      pieces.push(payload.subarray(offset, offset + length));
    } else if (kind === 'zero') {
      if (length > 1024 * 1024) fail('ช่วงข้อมูลว่างใหญ่เกินกำหนด');
      pieces.push(new Uint8Array(length));
    } else fail('ไม่รู้จักคำสั่งแพตช์');
    total += length;
  }
  if (total !== manifest.targetSize) fail('ขนาดไฟล์ผลลัพธ์ไม่ถูกต้อง');
  return new Blob(pieces, {type:'application/octet-stream'});
}

export async function applyKuonPatch(file, game, progress, log) {
  if (file.size !== game.sourceSize) fail('ต้องใช้ ISO Kuon Europe (En,Fr,De) ต้นฉบับ ขนาด 2,896,003,072 ไบต์');
  log('กำลังตรวจ SHA-256 ของ ISO ต้นฉบับ...');
  if (await hashBlob(file, p=>progress(5+Math.round(p*35))) !== game.sourceSha256) fail('ISO ไม่ตรงกับต้นฉบับที่รองรับ กรุณาเลือก Kuon Europe ต้นฉบับที่ยังไม่แพตช์');
  log('ISO ต้นฉบับตรงกัน ✓', 'ok');
  const manifestUrl = new URL(game.patchUrl, globalThis.location.href);
  const response = await fetch(manifestUrl);
  if (!response.ok) fail(`โหลดข้อมูลแพตช์ไม่สำเร็จ (${response.status})`);
  const manifestBytes = await response.arrayBuffer();
  if (await hex(manifestBytes) !== game.manifestSha256) fail('ข้อมูลแพตช์ไม่ตรงกับเวอร์ชันบนหน้าเว็บ กรุณารีเฟรชหน้าเว็บ');
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (manifest.format !== 'KUONCOPY1' || manifest.sourceSha256 !== game.sourceSha256 || manifest.targetSha256 !== game.targetSha256 ||
      manifest.sourceSize !== game.sourceSize || manifest.targetSize !== game.targetSize || !manifest.payload ||
      !integer(manifest.payload.size) || manifest.payload.size > 64*1024*1024 ||
      !integer(manifest.payload.decodedSize) || manifest.payload.decodedSize > 64*1024*1024) fail('ข้อมูลแพตช์ไม่ตรงกับเกมที่เลือก');
  log('กำลังดาวน์โหลดข้อมูลภาษาไทย...');
  const payloadResponse = await fetch(new URL(manifest.payload.url, manifestUrl));
  if (!payloadResponse.ok) fail(`ดาวน์โหลดแพตช์ไม่สำเร็จ (${payloadResponse.status})`);
  const packed = await payloadResponse.arrayBuffer();
  if (packed.byteLength !== manifest.payload.size || await hex(packed) !== manifest.payload.sha256) fail('ไฟล์แพตช์เสียหาย กรุณาลองใหม่');
  const decoded = await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const output = buildOutput(file, manifest, new Uint8Array(decoded));
  progress(55);
  log('กำลังตรวจ SHA-256 ของ ISO ภาษาไทย...');
  if (await hashBlob(output, p=>progress(55+Math.round(p*45))) !== game.targetSha256) fail('ผลลัพธ์ไม่ตรงกับ ISO ภาษาไทยที่ตรวจไว้');
  log('แพตช์ Kuon ภาษาไทย v2 สำเร็จ ✓ เลือก English ในเกม และตั้งภาพ 16:9', 'ok');
  progress(100);
  return output;
}
