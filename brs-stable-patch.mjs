// Materialize the result in OPFS: never export a Blob referencing Android's picker File.
export async function applyBrsStablePatch(file, g, progress, log, hashBlob, sha256Hex) {
  if (file.size !== g.sourceSize) throw new Error('ขนาด ISO ต้นฉบับไม่ตรงกับรุ่นที่รองรับ');
  if (!navigator.storage?.getDirectory) throw new Error('เบราว์เซอร์นี้ไม่รองรับพื้นที่สร้างไฟล์ กรุณาเปิดด้วย Chrome รุ่นล่าสุด');
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('brs-patch-temp', {create: true});
  // Remove only expired files owned by this patcher, never active downloads.
  for await (const [name] of dir.entries()) {
    const timestamp = Number(/^brs-(\d+)-/.exec(name)?.[1]);
    if (timestamp && Date.now() - timestamp > 86400000) await dir.removeEntry(name).catch(() => {});
  }
  const name = `brs-${Date.now()}-${crypto.randomUUID()}.iso`;
  let writer;
  const cleanup = () => dir.removeEntry(name).catch(() => {});
  try {
    const response = await fetch(g.patchUrl);
    if (!response.ok) throw new Error(`โหลดข้อมูลแพตช์ไม่สำเร็จ (${response.status})`);
    const m = await response.json();
    if (m.format !== 'FF1SPARSE1' || m.sourceSize !== g.sourceSize || m.sourceSha256 !== g.sourceSha256 || m.targetSize !== g.targetSize || m.targetSha256 !== g.targetSha256 || !Array.isArray(m.parts)) throw new Error('ข้อมูลแพตช์ไม่ตรงกับเกม');
    let end = 0;
    for (const p of m.parts) {
      if (!Number.isSafeInteger(p.offset) || !Number.isSafeInteger(p.length) || p.length <= 0 || p.offset < end || p.offset + p.length > m.targetSize || (p.offset > end && p.offset > file.size)) throw new Error('ช่วงข้อมูลแพตช์ไม่ถูกต้อง');
      end = p.offset + p.length;
    }
    if (end < m.targetSize && m.targetSize > file.size) throw new Error('แพตช์มีข้อมูลส่วนท้ายไม่ครบ');
    log('กำลังตรวจสอบ SHA-256 ของไฟล์ต้นฉบับ...');
    if (await hashBlob(file, r => progress(2 + Math.round(r * 28))) !== g.sourceSha256) throw new Error('SHA-256 ต้นฉบับไม่ตรงกับรุ่นที่รองรับ');
    log('SHA-256 ต้นฉบับตรงกัน ✓', 'ok');
    const handle = await dir.getFileHandle(name, {create: true});
    writer = await handle.createWritable();
    log('กำลังสร้างไฟล์ภาษาไทยแบบใช้หน่วยความจำต่ำ (แก้การอ่านไฟล์บนมือถือ)...');
    const blockSize = 4 * 1024 * 1024;
    let position = 0;
    const writeBytes = async bytes => {
      await writer.write(bytes);
      position += bytes.byteLength;
      progress(30 + Math.round(position / m.targetSize * 45));
    };
    const copyUntil = async limit => {
      while (position < limit) {
        const next = Math.min(position + blockSize, limit);
        // Explicitly read bytes before writing; do not pass file slices to the writer.
        const bytes = await file.slice(position, next).arrayBuffer();
        if (bytes.byteLength !== next - position) throw new Error('อ่าน ISO ต้นฉบับได้ไม่ครบ');
        await writeBytes(bytes);
      }
    };
    const base = new URL(g.patchUrl, location.href);
    for (let i = 0; i < m.parts.length; i++) {
      const p = m.parts[i];
      await copyUntil(p.offset);
      const part = await fetch(new URL(p.url, base));
      if (!part.ok) throw new Error(`โหลดชิ้นส่วน ${i + 1} ไม่สำเร็จ (${part.status})`);
      const bytes = await part.arrayBuffer();
      if (bytes.byteLength !== p.length || await sha256Hex(bytes) !== p.sha256) throw new Error(`ชิ้นส่วนแพตช์ ${i + 1} เสียหาย`);
      await writeBytes(bytes);
    }
    await copyUntil(m.targetSize);
    await writer.close();
    writer = null;
    // Obtain the snapshot only AFTER closing the writer.
    const output = await handle.getFile();
    if (output.size !== m.targetSize) throw new Error('ขนาดไฟล์ผลลัพธ์ไม่ถูกต้อง');
    log('กำลังตรวจสอบ SHA-256 ของไฟล์ภาษาไทย...');
    if (await hashBlob(output, r => progress(75 + Math.round(r * 25))) !== g.targetSha256) throw new Error('SHA-256 ผลลัพธ์ไม่ตรง จึงยกเลิกไฟล์');
    log('SHA-256 ผลลัพธ์ตรงกัน — แปะแพตช์สำเร็จ ✓', 'ok');
    progress(100);
    return output;
  } catch (error) {
    if (writer) await writer.abort().catch(() => {});
    await cleanup();
    if (error.name === 'QuotaExceededError') throw new Error('พื้นที่ชั่วคราวไม่พอ กรุณาเพิ่มพื้นที่ว่างอย่างน้อย 3 GB แล้วลองใหม่');
    if (error.name === 'NotReadableError') throw new Error('อ่านไฟล์ไม่ได้ กรุณาคัดลอก ISO ลง Download ในเครื่อง แล้วเลือกใหม่ โดยเปิดหน้านี้ค้างไว้');
    throw error;
  }
}
