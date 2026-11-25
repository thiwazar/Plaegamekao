import { hashBlob } from '../odin-sha256.mjs';

export async function patch(source, manifest, loadChunk, status = () => {}) {
  if (source.size !== manifest.sourceSize) throw new Error('ขนาด ISO ไม่ตรงกับต้นฉบับที่รองรับ');
  const hash = await hashBlob(source, value => status('ตรวจต้นฉบับ', value));
  if (hash !== manifest.sourceSha256) throw new Error('SHA-256 ของ ISO ไม่ตรงกับต้นฉบับที่รองรับ');

  const chunks = [];
  for (const [index, entry] of manifest.chunks.entries()) {
    status('เตรียมข้อมูลภาษาไทย', index / manifest.chunks.length);
    const chunk = await loadChunk(entry.name);
    if (chunk.size !== entry.size || await hashBlob(chunk) !== entry.sha256) {
      throw new Error('ข้อมูลภาษาไทยโหลดมาไม่ครบ ลองใหม่อีกครั้ง');
    }
    chunks.push(chunk);
  }
  const parts = manifest.parts.map(([index, start, length]) => {
    const blob = index === -1 ? source : chunks[index];
    if (!blob || start < 0 || length <= 0 || start + length > blob.size) {
      throw new Error('ตำแหน่งข้อมูล ISO ไม่ถูกต้อง');
    }
    return blob.slice(start, start + length);
  });
  const output = new Blob(parts, { type: 'application/octet-stream' });
  if (output.size !== manifest.targetSize ||
      await hashBlob(output, value => status('ตรวจ ISO ภาษาไทย', value)) !== manifest.targetSha256) {
    throw new Error('ISO ภาษาไทยไม่ผ่านการตรวจสอบ');
  }
  return output;
}
