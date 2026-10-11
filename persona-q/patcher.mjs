// Chunked hashing and Blob slices keep a 2 GiB ROM out of WASM memory.
export async function hashBlob(blob, progress = () => {}) {
  const hash = await globalThis.hashwasm.createSHA256();
  hash.init();
  for (let offset = 0; offset < blob.size; offset += 4 * 1024 * 1024) {
    hash.update(new Uint8Array(await blob.slice(offset, offset + 4 * 1024 * 1024).arrayBuffer()));
    progress(Math.min(1, (offset + 4 * 1024 * 1024) / blob.size));
  }
  return hash.digest('hex');
}

export async function applyQgdeltaStreaming(file, game, progress, log) {
  if (file.size !== game.sourceSize) throw new Error('ขนาด ROM ไม่ตรงกับ Persona Q USA ที่รองรับ');
  log('กำลังตรวจสอบ ROM ทีละส่วน...');
  if (await hashBlob(file, n => progress(2 + Math.round(n * 28))) !== game.sourceSha256)
    throw new Error('SHA-256 ไม่ตรง: ต้องใช้ ROM .3ds USA ต้นฉบับตามที่ระบุ');
  const response = await fetch(game.patchUrl);
  if (!response.ok) throw new Error('โหลดแพตช์ไม่สำเร็จ: ' + response.status);
  const patch = await response.blob();
  if (await hashBlob(patch) !== game.patchSha256) throw new Error('ไฟล์แพตช์เสียหรือไม่ตรงเวอร์ชัน');
  const zip = await globalThis.JSZip.loadAsync(await patch.arrayBuffer());
  const entries = JSON.parse(await zip.file('index.json').async('string'));
  const parts = [];
  let cursor = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!Number.isSafeInteger(entry.offset) || !Number.isSafeInteger(entry.length) ||
        entry.length < 0 || entry.offset < cursor || entry.offset + entry.length > game.targetSize)
      throw new Error('ตำแหน่งชิ้นส่วนแพตช์ไม่ถูกต้อง');
    const data = await zip.file(entry.name).async('uint8array');
    if (data.length !== entry.length) throw new Error('ชิ้นส่วนแพตช์ไม่ครบ');
    parts.push(file.slice(cursor, entry.offset), data);
    cursor = entry.offset + data.length;
    progress(30 + Math.round((i + 1) / entries.length * 35));
  }
  parts.push(file.slice(cursor, game.targetSize));
  const output = new Blob(parts);
  if (output.size !== game.targetSize) throw new Error('ขนาดผลลัพธ์ไม่ถูกต้อง');
  log('กำลังตรวจสอบ ROM ที่แพตช์แล้ว...');
  if (await hashBlob(output, n => progress(65 + Math.round(n * 35))) !== game.targetSha256)
    throw new Error('SHA-256 ผลลัพธ์ไม่ตรง จึงยกเลิกการดาวน์โหลด');
  log('ตรวจสอบสำเร็จ ดาวน์โหลด ROM ภาษาไทยได้', 'ok');
  return output;
}
