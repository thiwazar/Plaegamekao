// Strict, windowed RFC 3284 decoder for the two pinned Dissidia patches.
// No secondary compression, custom code tables, or VCD_TARGET dictionaries.
// Source dictionaries and target windows are bounded; source ISO is never read whole.
const MAX_SOURCE_WINDOW = 128 * 1024 * 1024;
const MAX_TARGET_WINDOW = 16 * 1024 * 1024;
class Reader {
  constructor(bytes, start = 0, end = bytes.length) { this.b = bytes; this.p = start; this.end = end; }
  byte() { if (this.p >= this.end) throw new Error('แพตช์ขาดหายหรือข้อมูลเกินขอบเขต'); return this.b[this.p++]; }
  integer() {
    let n = 0;
    for (let i = 0; i < 8; i++) {
      const b = this.byte(); n = n * 128 + (b & 127);
      if (!Number.isSafeInteger(n)) throw new Error('ค่าในแพตช์ใหญ่เกินขอบเขต');
      if (!(b & 128)) return n;
    }
    throw new Error('รูปแบบจำนวนเต็มในแพตช์ไม่ถูกต้อง');
  }
  section(n) { if (!Number.isSafeInteger(n) || n < 0 || n > this.end - this.p) throw new Error('ขนาดส่วนแพตช์ไม่ถูกต้อง'); const r = new Reader(this.b, this.p, this.p + n); this.p += n; return r; }
}
function table() {
  const t = [[['RUN', 0, 0]]];
  for (let s = 0; s <= 17; s++) t.push([['ADD', s, 0]]);
  for (let m = 0; m < 9; m++) for (const s of [0, ...Array.from({length:15}, (_, i) => i+4)]) t.push([['COPY', s, m]]);
  for (let m = 0; m < 6; m++) for (let a = 1; a <= 4; a++) for (let c = 4; c <= 6; c++) t.push([['ADD', a, 0], ['COPY', c, m]]);
  for (let m = 6; m < 9; m++) for (let a = 1; a <= 4; a++) t.push([['ADD', a, 0], ['COPY', 4, m]]);
  for (let m = 0; m < 9; m++) t.push([['COPY', 4, m], ['ADD', 1, 0]]);
  if (t.length !== 256) throw new Error('Internal code table error'); return t;
}
const CODE_TABLE = table();
export function adler32(data) {
  let a = 1, b = 0;
  for (let p = 0; p < data.length;) {
    const end = Math.min(p + 5552, data.length);
    while (p < end) { a += data[p++]; b += a; }
    a %= 65521; b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}
export async function* decodeWindows(source, patchBytes, expectedSize) {
  const r = new Reader(patchBytes);
  if ([0xd6,0xc3,0xc4,0].some(v => r.byte() !== v)) throw new Error('ไม่ใช่แพตช์ VCDIFF ที่รองรับ');
  const header = r.byte();
  if (header & ~4) throw new Error('แพตช์ใช้การบีบอัดหรือตารางที่ตัวอ่านนี้ไม่รองรับ');
  if (header & 4) r.section(r.integer());
  let writtenTotal = 0, windowIndex = 0;
  while (r.p < r.end) {
    const flag = r.byte();
    if ((flag & ~5) !== 0) throw new Error('แพตช์ใช้ source window ที่ไม่รองรับ');
    let sourceLength = 0, sourceOffset = 0;
    if (flag & 1) { sourceLength = r.integer(); sourceOffset = r.integer(); }
    if (sourceLength > MAX_SOURCE_WINDOW || sourceOffset > source.size - sourceLength) throw new Error('ขอบเขต ISO ต้นทางในแพตช์ไม่ถูกต้อง');
    const delta = r.section(r.integer());
    const targetLength = delta.integer();
    if (!targetLength || targetLength > MAX_TARGET_WINDOW || targetLength > expectedSize - writtenTotal) throw new Error('ขนาดผลลัพธ์ในแพตช์ไม่ถูกต้อง');
    if (delta.byte() !== 0) throw new Error('แพตช์นี้บีบอัดภายใน กรุณาใช้แพตช์ FontFix ที่มากับเว็บ');
    const dataLength = delta.integer(), instructionLength = delta.integer(), addressLength = delta.integer();
    let checksum;
    if (flag & 4) checksum = (delta.byte()*0x1000000 + delta.byte()*0x10000 + delta.byte()*0x100 + delta.byte()) >>> 0;
    const data = delta.section(dataLength), instructions = delta.section(instructionLength), addresses = delta.section(addressLength);
    if (delta.p !== delta.end) throw new Error('ความยาวแพตช์ไม่ตรงกับ header');
    const dictionary = sourceLength ? new Uint8Array(await source.slice(sourceOffset, sourceOffset + sourceLength).arrayBuffer()) : new Uint8Array();
    if (dictionary.length !== sourceLength) throw new Error('อ่าน ISO ต้นทางไม่ครบ');
    const target = new Uint8Array(targetLength), near = new Float64Array(4), same = new Float64Array(768);
    let nextNear = 0, written = 0, materializedBytes = 0;
    const spans = [];
    const addSpan=(sourceStart,targetStart,length)=>{
      const prev=spans[spans.length-1];
      if(prev && ((sourceStart!==null && prev.sourceStart!==null && prev.sourceStart+prev.length===sourceStart) || (sourceStart===null && prev.sourceStart===null && prev.targetStart+prev.length===targetStart)))prev.length+=length;
      else spans.push({sourceStart,targetStart,length});
    };
    while (instructions.p < instructions.end) {
      for (const [kind, fixedSize, mode] of CODE_TABLE[instructions.byte()]) {
        const size = fixedSize || instructions.integer();
        if (size <= 0 || size > targetLength - written) throw new Error('คำสั่งแพตช์เกินขนาดหน้าต่าง');
        if (kind === 'ADD') { const part = data.section(size); const literal=part.b.subarray(part.p, part.end); target.set(literal, written); addSpan(null,written,size); materializedBytes+=size; written += size; }
        else if (kind === 'RUN') { target.fill(data.byte(), written, written + size); addSpan(null,written,size); materializedBytes+=size; written += size; }
        else {
          let address;
          if (mode === 0) address = addresses.integer();
          else if (mode === 1) address = sourceLength + written - addresses.integer();
          else if (mode < 6) address = near[mode-2] + addresses.integer();
          else address = same[(mode-6)*256 + addresses.byte()];
          if (!Number.isSafeInteger(address) || address < 0 || address >= sourceLength + written) throw new Error('ตำแหน่ง COPY ไม่ถูกต้อง');
          near[nextNear] = address; nextNear = (nextNear+1)%4; same[address%768] = address;
          let count = size;
          if (address < sourceLength) {
            const n = Math.min(count, sourceLength-address); addSpan(sourceOffset+address,null,n); target.set(dictionary.subarray(address,address+n), written); written += n; address += n; count -= n;
          }
          if (count) {
            const from = address - sourceLength; const copyStart=written;
            if (from < 0 || from >= written) throw new Error('COPY อ้างอิงข้อมูลที่ยังไม่มี');
            if (from+count <= written) { target.set(target.subarray(from,from+count),written); written += count; }
            else { for (let i=0;i<count;i++) target[written+i]=target[from+i]; written += count; }
            addSpan(null,copyStart,count); materializedBytes+=count;
          }
        }
      }
    }
    if (written !== targetLength || data.p !== data.end || addresses.p !== addresses.end) throw new Error('ถอดรหัสแพตช์ได้ข้อมูลไม่ครบ');
    if (checksum !== undefined && adler32(target) !== checksum) throw new Error('Checksum ของแพตช์ไม่ตรง');
    writtenTotal += targetLength; windowIndex++;
    const parts=spans.map(s=>s.sourceStart!==null ? source.slice(s.sourceStart,s.sourceStart+s.length) : new Blob([target.subarray(s.targetStart,s.targetStart+s.length)]));
    yield {bytes:target, parts, materializedBytes, written:writtenTotal, windowIndex};
  }
  if (writtenTotal !== expectedSize) throw new Error('ขนาด ISO ปลายทางไม่ตรง');
}
