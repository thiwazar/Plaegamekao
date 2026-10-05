export async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function prepareSource(input, manifest) {
  let bytes = new Uint8Array(input);
  let headerRemoved = false;
  if (manifest.sources.some(s => bytes.length === s.size + 512)) {
    bytes = bytes.slice(512); headerRemoved = true;
  }
  if (!manifest.sources.some(s => bytes.length === s.size)) throw new Error('ขนาด ROM ไม่ตรงกับรุ่นที่รองรับ');
  const hash = await sha256(bytes);
  const source = manifest.sources.find(s => s.size === bytes.length && s.sha256 === hash);
  if (!source) throw new Error('ROM ไม่ตรงกับต้นฉบับที่รองรับ กรุณาตรวจรุ่นตามที่ระบุบนหน้านี้');
  return {bytes, headerRemoved, source};
}
export function applyIps(source, patch, targetSize) {
  const p = new Uint8Array(patch);
  const text = (a,b) => String.fromCharCode(...p.subarray(a,b));
  if (p.length < 8 || text(0,5) !== 'PATCH') throw new Error('รูปแบบแพทช์ไม่ถูกต้อง');
  const out = new Uint8Array(targetSize); out.set(source.subarray(0, targetSize));
  let at = 5;
  const need = n => { if (at + n > p.length) throw new Error('แพทช์ไม่ครบ'); };
  while (true) {
    need(3);
    if (text(at,at+3) === 'EOF') {
      at += 3;
      if (at+3 === p.length) {
        if(p[at]*65536+p[at+1]*256+p[at+2] !== targetSize) throw new Error('ขนาดท้ายแพทช์ไม่ตรง');
      } else if (at !== p.length) throw new Error('มีข้อมูลเกินท้ายแพทช์');
      return out;
    }
    const offset = p[at]*65536+p[at+1]*256+p[at+2]; at += 3;
    need(2); let length = p[at]*256+p[at+1]; at += 2;
    if (length === 0) {
      need(3); length = p[at]*256+p[at+1]; const value=p[at+2]; at += 3;
      if (!length || offset+length > out.length) throw new Error('ข้อมูลแพทช์เกินขนาด ROM');
      out.fill(value,offset,offset+length);
    } else {
      need(length);
      if (offset+length > out.length) throw new Error('ข้อมูลแพทช์เกินขนาด ROM');
      out.set(p.subarray(at,at+length),offset); at += length;
    }
  }
}
export async function patchRom(input, patch, manifest) {
  const {bytes,headerRemoved,source} = await prepareSource(input, manifest);
  if (await sha256(patch) !== source.patchSha256) throw new Error('ไฟล์แพทช์เสียหาย กรุณาโหลดหน้าใหม่');
  const output = applyIps(bytes, patch, manifest.targetSize);
  if (await sha256(output) !== manifest.targetSha256) throw new Error('ผลลัพธ์ไม่ผ่านการตรวจสอบ จึงไม่สร้างไฟล์ดาวน์โหลด');
  return {output,headerRemoved};
}
