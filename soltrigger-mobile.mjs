// Sol Trigger: bounded-memory reads; output is an independent OPFS file.
const CHUNK = 2 * 1024 * 1024;
const PATCH_LIMIT = 32 * 1024 * 1024;
const PATCH_SHA256 = '1bb72c2fd5921c0db458c9a655ec8a1ff5fda1d75a7986e48b03879a79b46e35';

export function parseStpatch(bytes, game) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bad = () => { throw new Error('โครงสร้างแพตช์ Sol Trigger ไม่ถูกต้อง'); };
  if (bytes.length < 12 || new TextDecoder().decode(bytes.subarray(0, 8)) !== 'STPATCH1') bad();
  const size = view.getUint32(8, true);
  if (size > 65536 || 12 + size > bytes.length) bad();
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + size)));
  if (meta.format !== 'STPATCH1' || meta.source_size !== game.sourceSize || meta.target_size !== game.targetSize || meta.source_sha256 !== game.sourceSha256 || meta.target_sha256 !== game.targetSha256 || !Number.isSafeInteger(meta.changed_blocks) || meta.changed_blocks < 1 || meta.changed_blocks > 100000) bad();
  let cursor = 12 + size, end = 0;
  const blocks = [];
  for (let i = 0; i < meta.changed_blocks; i++) {
    if (cursor + 16 > bytes.length) bad();
    const offset = Number(view.getBigUint64(cursor, true));
    const length = view.getUint32(cursor + 8, true), compressed = view.getUint32(cursor + 12, true);
    cursor += 16;
    if (!Number.isSafeInteger(offset) || offset < end || !length || length > 16 * CHUNK || !compressed || cursor + compressed > bytes.length || offset + length > game.targetSize) bad();
    blocks.push({offset, length, bytes: bytes.subarray(cursor, cursor + compressed)});
    cursor += compressed; end = offset + length;
  }
  if (cursor !== bytes.length) bad();
  return blocks;
}

export async function writeStpatch(file, game, blocks, writer, progress = () => {}) {
  let position = 0;
  const write = async bytes => {
    await writer.write(bytes);
    position += bytes.byteLength;
    progress(position / game.targetSize);
  };
  const copyUntil = async limit => {
    while (position < limit) {
      const end = Math.min(position + CHUNK, limit);
      if (position < file.size) {
        const sourceEnd = Math.min(end, file.size);
        const bytes = await file.slice(position, sourceEnd).arrayBuffer();
        if (bytes.byteLength !== sourceEnd - position) throw new Error('อ่าน ISO ต้นฉบับได้ไม่ครบ');
        await write(bytes);
      } else {
        await write(new Uint8Array(end - position));
      }
    }
  };
  for (const block of blocks) {
    await copyUntil(block.offset);
    const reader = new Blob([block.bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    let expanded = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        if (expanded + value.byteLength > block.length) throw new Error('ขนาดข้อมูลแพตช์เกินที่กำหนด');
        await write(value); expanded += value.byteLength;
      }
      if (expanded !== block.length) throw new Error('ข้อมูลแพตช์ถอดรหัสได้ไม่ครบ');
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  await copyUntil(game.targetSize);
}

export async function applySolTriggerMobile(file, game, progress, log, hashBlob, sha256Hex) {
  if (file.size !== game.sourceSize) throw new Error('ขนาด ISO ไม่ตรง ต้องใช้ Sol Trigger English v09 ต้นฉบับ');
  if (!navigator.storage?.getDirectory) throw new Error('เบราว์เซอร์นี้ไม่มีพื้นที่สร้างไฟล์ชั่วคราว กรุณาใช้ Chrome หรือ Brave รุ่นล่าสุดในโหมดปกติ');
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('soltrigger-patch-temp', {create: true});
  // Expire only this patcher's own day-old temporary output files.
  for await (const [name] of dir.entries()) {
    const stamp = Number(/^sol-(\d+)-/.exec(name)?.[1]);
    if (stamp && Date.now() - stamp > 86400000) await dir.removeEntry(name).catch(() => {});
  }
  const estimate = await navigator.storage.estimate?.().catch(() => null);
  const required = game.targetSize + 128 * 1024 * 1024;
  if (estimate?.quota && estimate.quota - (estimate.usage || 0) < required) throw new Error('พื้นที่เว็บไซต์ไม่พอสำหรับสร้าง ISO กรุณาเพิ่มพื้นที่ว่างอย่างน้อย 2 GB แล้วลองใหม่');
  const name = `sol-${Date.now()}-${crypto.randomUUID()}.iso`;
  let writer, fetchReader;
  try {
    log('กำลังตรวจ SHA-256 ต้นฉบับแบบอ่านทีละส่วน (ประหยัด RAM)...');
    if (await hashBlob(file, r => progress(2 + Math.round(r * 28))) !== game.sourceSha256) throw new Error('SHA-256 ต้นฉบับไม่ตรง ต้องใช้ Sol Trigger English v09 ที่ยังไม่ลงแพตช์');
    log('SHA-256 ต้นฉบับตรงกัน ✓', 'ok');
    log('กำลังโหลดแพตช์ Sol Trigger...');
    const response = await fetch(game.patchUrl);
    if (!response.ok || !response.body) throw new Error(`โหลดแพตช์ไม่สำเร็จ (${response.status})`);
    fetchReader = response.body.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const {done, value} = await fetchReader.read();
      if (done) break;
      total += value.byteLength;
      if (total > PATCH_LIMIT) throw new Error('ไฟล์แพตช์มีขนาดผิดปกติ');
      chunks.push(value);
    }
    fetchReader.releaseLock(); fetchReader = null;
    const patch = new Uint8Array(await new Blob(chunks).arrayBuffer());
    chunks.length = 0;
    if (await sha256Hex(patch) !== PATCH_SHA256) throw new Error('ไฟล์แพตช์เสียหาย กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง');
    const blocks = parseStpatch(patch, game);
    const handle = await dir.getFileHandle(name, {create: true});
    writer = await handle.createWritable();
    log('กำลังสร้าง ISO ลงพื้นที่ชั่วคราวแบบประหยัด RAM — เปิดหน้านี้ค้างไว้...');
    await writeStpatch(file, game, blocks, writer, r => progress(32 + Math.round(r * 43)));
    await writer.close(); writer = null;
    const output = await handle.getFile();
    if (output.size !== game.targetSize) throw new Error('ขนาดไฟล์ผลลัพธ์ไม่ตรง');
    log('กำลังตรวจ SHA-256 ของ ISO ภาษาไทยแบบอ่านทีละส่วน...');
    if (await hashBlob(output, r => progress(75 + Math.round(r * 25))) !== game.targetSha256) throw new Error('SHA-256 ผลลัพธ์ไม่ตรง จึงยกเลิกไฟล์');
    log('SHA-256 ผลลัพธ์ตรงกัน — แปะแพตช์สำเร็จ ✓', 'ok');
    progress(100);
    return output;
  } catch (error) {
    if (fetchReader) await fetchReader.cancel().catch(() => {});
    if (writer) await writer.abort().catch(() => {});
    await dir.removeEntry(name).catch(() => {});
    if (error.name === 'QuotaExceededError') throw new Error('พื้นที่สร้าง ISO ไม่พอ กรุณาเพิ่มพื้นที่ว่างอย่างน้อย 2 GB แล้วลองใหม่');
    if (error.name === 'NotReadableError') throw new Error('อ่าน ISO ไม่ได้ กรุณาคัดลอกไฟล์ลงโฟลเดอร์ Download ในเครื่อง แล้วเลือกใหม่');
    throw error;
  }
}
