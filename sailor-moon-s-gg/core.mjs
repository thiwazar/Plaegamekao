const SOURCE = '6714450e43957940ce844d91dec32ea2f55c8d9a91aa2cdb4a8f19cd0fe43376';
const TARGET = '316758c8b0f7f04a029fad72a3566ac6836598072a3f3adaf4165d2d5e787a8e';
const SIZE = 1048576;

async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function patchRom(file) {
  if (file.size !== SIZE) throw new Error('ขนาดไฟล์ไม่ตรงกับ ROM English v1.1 ที่รองรับ');
  const output = new Uint8Array(await file.arrayBuffer());
  if (await sha256(output) !== SOURCE) throw new Error('ไฟล์นี้ไม่ตรงกับ SHA-256 ของ ROM English v1.1 ที่รองรับ');
  const response = await fetch(new URL('./payload.dat', import.meta.url));
  if (!response.ok) throw new Error('โหลดข้อมูลสำหรับแปะแพตช์ไม่สำเร็จ กรุณาลองอีกครั้ง');
  const payload = new DataView(await response.arrayBuffer());
  let cursor = 0;
  let end = 0;
  while (cursor < payload.byteLength) {
    if (payload.byteLength - cursor < 8) throw new Error('ข้อมูลแพตช์ไม่ครบ');
    const offset = payload.getUint32(cursor, true);
    const length = payload.getUint32(cursor + 4, true);
    cursor += 8;
    if (!length || offset < end || offset + length > SIZE || cursor + length > payload.byteLength) {
      throw new Error('ตำแหน่งข้อมูลแพตช์ไม่ถูกต้อง');
    }
    output.set(new Uint8Array(payload.buffer, cursor, length), offset);
    end = offset + length;
    cursor += length;
  }
  if (await sha256(output) !== TARGET) throw new Error('ผลลัพธ์ไม่ตรงกับ SHA-256 ของชุด 008');
  return new Blob([output], {type: 'application/octet-stream'});
}
