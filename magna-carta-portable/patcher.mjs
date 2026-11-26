import { hashBlob } from '../odin-sha256.mjs';

const READ_SIZE = 2 * 1024 * 1024;

export async function patch(source, manifest, loadChunk, status = () => {}, storage = navigator.storage) {
  if (source.size !== manifest.sourceSize) throw new Error('ขนาด ISO ไม่ตรงกับต้นฉบับที่รองรับ');
  if (!storage?.getDirectory) throw new Error('เบราว์เซอร์นี้ไม่รองรับพื้นที่สร้างไฟล์ชั่วคราว ลองใช้ Chrome หรือ Brave รุ่นใหม่ในโหมดปกติ');
  status('ตรวจต้นฉบับ', 0);
  if (await hashBlob(source, value => status('ตรวจต้นฉบับ', value)) !== manifest.sourceSha256) throw new Error('SHA-256 ของ ISO ไม่ตรงกับต้นฉบับที่รองรับ');
  const root = await storage.getDirectory();
  const dir = await root.getDirectoryHandle('magna-carta-patch', {create: true});
  for await (const [name] of dir.entries()) {
    const match = /^output-(\d+)-[a-z0-9-]+\.iso(?:-chunk-\d+)?$/.exec(name);
    if (match && Date.now() - Number(match[1]) > 86400000) await dir.removeEntry(name).catch(() => {});
  }
  const estimate = await storage.estimate?.().catch(() => null);
  if (estimate?.quota && estimate.quota - (estimate.usage || 0) < manifest.targetSize + manifest.chunks.reduce((sum, c) => sum + c.size, 0) + 128 * 1024 * 1024) throw new Error('พื้นที่เว็บไซต์ไม่พอ กรุณาเพิ่มพื้นที่ว่างแล้วลองใหม่');
  const name = `output-${Date.now()}-${crypto.randomUUID()}.iso`;
  let writer;
  const temporaryChunks = [];
  try {
    for (const [index, entry] of manifest.chunks.entries()) {
      status('โหลดข้อมูลภาษาไทย', index / manifest.chunks.length);
      const data = await loadChunk(entry.name);
      if (data.size !== entry.size || await hashBlob(data) !== entry.sha256) throw new Error('ข้อมูลภาษาไทยโหลดมาไม่ครบ ลองใหม่อีกครั้ง');
      const chunkName = `${name}-chunk-${index}`;
      const chunkHandle = await dir.getFileHandle(chunkName, {create: true});
      temporaryChunks.push(chunkName);
      const chunkWriter = await chunkHandle.createWritable();
      try { await chunkWriter.write(data); await chunkWriter.close(); }
      catch (error) { await chunkWriter.abort().catch(() => {}); throw error; }
    }
    const handle = await dir.getFileHandle(name, {create: true});
    writer = await handle.createWritable();
    let bytesWritten = 0, cachedIndex = -1, cachedChunk = null;
    for (const [index, start, length] of manifest.parts) {
      if (!Number.isSafeInteger(index) || !Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length <= 0) throw new Error('ตำแหน่งข้อมูล ISO ไม่ถูกต้อง');
      let input = source;
      if (index !== -1) {
        const entry = manifest.chunks[index];
        if (!entry) throw new Error('ข้อมูลแพตช์ไม่ถูกต้อง');
        if (cachedIndex !== index) {
          cachedChunk = await (await dir.getFileHandle(temporaryChunks[index])).getFile();
          cachedIndex = index;
        }
        input = cachedChunk;
      }
      if (start + length > input.size || bytesWritten + length > manifest.targetSize) throw new Error('ตำแหน่งข้อมูล ISO ไม่ถูกต้อง');
      for (let p = 0; p < length; p += READ_SIZE) {
        const n = Math.min(READ_SIZE, length - p);
        const buffer = await input.slice(start + p, start + p + n).arrayBuffer();
        if (buffer.byteLength !== n) throw new Error('อ่านข้อมูล ISO ไม่ครบ');
        await writer.write(buffer);
        bytesWritten += n;
        status('สร้าง ISO ภาษาไทย', bytesWritten / manifest.targetSize);
      }
    }
    if (bytesWritten !== manifest.targetSize) throw new Error('ขนาด ISO ภาษาไทยไม่ถูกต้อง');
    await writer.close(); writer = null;
    const output = await handle.getFile();
    if (output.size !== manifest.targetSize || await hashBlob(output, value => status('ตรวจ ISO ภาษาไทย', value)) !== manifest.targetSha256) throw new Error('ISO ภาษาไทยไม่ผ่านการตรวจสอบ');
    for (const chunkName of temporaryChunks) await dir.removeEntry(chunkName).catch(() => {});
    return output;
  } catch (error) {
    if (writer) await writer.abort().catch(() => {});
    await dir.removeEntry(name).catch(() => {});
    for (const chunkName of temporaryChunks) await dir.removeEntry(chunkName).catch(() => {});
    if (error.name === 'QuotaExceededError') throw new Error('พื้นที่สำหรับสร้าง ISO ไม่พอ กรุณาเพิ่มพื้นที่ว่างแล้วลองใหม่');
    throw error;
  }
}
