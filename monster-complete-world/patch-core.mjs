export function hex(bytes) {
  return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
export async function applyPatch(source, patch, manifest, progress = () => {}) {
  if (source.length !== manifest.sourceSize) throw new Error('ขนาด BIN ไม่ตรงกับแผ่นญี่ปุ่น SLPS 018.70 ที่รองรับ');
  progress('กำลังตรวจ SHA-256 ของ BIN ต้นฉบับ…');
  if (await sha256(source) !== manifest.sourceSha256) throw new Error('BIN ไม่ตรงกับต้นฉบับ ใช้แผ่นญี่ปุ่น SLPS 018.70 ที่ยังไม่แปะแพตช์');
  if (patch.length !== manifest.patchSize || await sha256(patch) !== manifest.patchSha256) throw new Error('ไฟล์แพตช์ไม่ผ่านการตรวจสอบ');
  if (patch.length < 93 || new TextDecoder().decode(patch.subarray(0, 9)) !== 'MCWSPARS1') throw new Error('รูปแบบแพตช์ไม่ถูกต้อง');
  const view = new DataView(patch.buffer, patch.byteOffset, patch.byteLength);
  if (view.getBigUint64(9, true) !== BigInt(manifest.sourceSize) || view.getBigUint64(17, true) !== BigInt(manifest.targetSize) ||
      hex(patch.subarray(29, 61)) !== manifest.sourceSha256 || hex(patch.subarray(61, 93)) !== manifest.targetSha256) throw new Error('แพตช์ไม่ตรงกับรุ่นที่เลือก');
  progress('กำลังสร้างไฟล์ภาษาไทยในเครื่องนี้…');
  const decompressed = await new Response(new Blob([patch.subarray(93)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  const records = new Uint8Array(decompressed), dv = new DataView(decompressed);
  const output = new Uint8Array(manifest.targetSize);
  output.set(source.subarray(0, output.length));
  let cursor = 0, previousEnd = 0;
  for (let i = 0; i < view.getUint32(25, true); i++) {
    if (cursor + 12 > records.length) throw new Error('ข้อมูลแพตช์ขาดหาย');
    const offsetBig = dv.getBigUint64(cursor, true), length = dv.getUint32(cursor + 8, true); cursor += 12;
    if (offsetBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('ตำแหน่งแพตช์เกินขอบเขต');
    const offset = Number(offsetBig);
    if (!length || offset < previousEnd || offset + length > output.length || cursor + length > records.length) throw new Error('ช่วงข้อมูลแพตช์ไม่ถูกต้อง');
    output.set(records.subarray(cursor, cursor + length), offset); cursor += length; previousEnd = offset + length;
  }
  if (cursor !== records.length) throw new Error('ข้อมูลแพตช์มีส่วนเกิน');
  progress('กำลังตรวจไฟล์ภาษาไทยก่อนดาวน์โหลด…');
  if (await sha256(output) !== manifest.targetSha256) throw new Error('ไฟล์ผลลัพธ์ไม่ผ่าน SHA-256');
  return output;
}
