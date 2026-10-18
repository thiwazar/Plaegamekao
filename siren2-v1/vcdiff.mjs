// Strict, windowed RFC 3284 decoder for the pinned Forbidden Siren 2 v1.0 patch.
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
// Buffers one verified download part and one delta window, never the full patch.
class StreamReader {
  constructor(input) {
    this.iterator=(input instanceof Uint8Array ? (async function*(){yield input;})() : input)[Symbol.asyncIterator]();
    this.chunk=new Uint8Array();this.offset=0;this.done=false;
  }
  async available() {
    while(this.offset===this.chunk.length&&!this.done){
      this.chunk=new Uint8Array();this.offset=0;
      const next=await this.iterator.next();this.done=Boolean(next.done);
      if(!this.done){if(!(next.value instanceof Uint8Array))throw Error('Invalid patch chunk');this.chunk=next.value;}
    }
    return !this.done;
  }
  async byte(){if(!await this.available())throw Error('แพตช์ขาดหาย');return this.chunk[this.offset++];}
  async integer(){let n=0;for(let i=0;i<8;i++){const b=await this.byte();n=n*128+(b&127);if(!Number.isSafeInteger(n))throw Error('ค่าในแพตช์ใหญ่เกินขอบเขต');if(!(b&128))return n;}throw Error('รูปแบบจำนวนเต็มไม่ถูกต้อง');}
  async section(n){
    if(!Number.isSafeInteger(n)||n<0||n>64*1024*1024)throw Error('ส่วนแพตช์ใหญ่เกินขอบเขต');
    const bytes=new Uint8Array(n);let p=0;
    while(p<n){if(!await this.available())throw Error('แพตช์ขาดหาย');const count=Math.min(n-p,this.chunk.length-this.offset);bytes.set(this.chunk.subarray(this.offset,this.offset+count),p);p+=count;this.offset+=count;}
    return new Reader(bytes);
  }
  async close(){this.chunk=new Uint8Array();await this.iterator.return?.();}
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
export async function* decodeWindows(source, patchBytes, expectedSize, activity=()=>{}) {
  const r = new StreamReader(patchBytes);
  try {
  for (const v of [0xd6,0xc3,0xc4,0]) if (await r.byte() !== v) throw new Error('ไม่ใช่แพตช์ VCDIFF ที่รองรับ');
  const header = await r.byte();
  if (header & ~4) throw new Error('แพตช์ใช้การบีบอัดหรือตารางที่ตัวอ่านนี้ไม่รองรับ');
  if (header & 4) await r.section(await r.integer());
  let writtenTotal = 0, windowIndex = 0;
  while (await r.available()) {
    const flag = await r.byte();
    if ((flag & ~5) !== 0) throw new Error('แพตช์ใช้ source window ที่ไม่รองรับ');
    let sourceLength = 0, sourceOffset = 0;
    if (flag & 1) { sourceLength = await r.integer(); sourceOffset = await r.integer(); }
    if (sourceLength > MAX_SOURCE_WINDOW || sourceOffset > source.size - sourceLength) throw new Error('ขอบเขต ISO ต้นทางในแพตช์ไม่ถูกต้อง');
    const delta = await r.section(await r.integer());
    const targetLength = delta.integer();
    if (!targetLength || targetLength > MAX_TARGET_WINDOW || targetLength > expectedSize - writtenTotal) throw new Error('ขนาดผลลัพธ์ในแพตช์ไม่ถูกต้อง');
    if (delta.byte() !== 0) throw new Error('แพตช์นี้บีบอัดภายใน กรุณาใช้แพตช์ Siren 2 v1.0 ที่มากับเว็บ');
    const dataLength = delta.integer(), instructionLength = delta.integer(), addressLength = delta.integer();
    let checksum;
    if (flag & 4) checksum = (delta.byte()*0x1000000 + delta.byte()*0x10000 + delta.byte()*0x100 + delta.byte()) >>> 0;
    const data = delta.section(dataLength), instructions = delta.section(instructionLength), addresses = delta.section(addressLength);
    if (delta.p !== delta.end) throw new Error('ความยาวแพตช์ไม่ตรงกับ header');
    activity('อ่าน ISO ต้นฉบับ',writtenTotal);
    const dictionary = sourceLength ? new Uint8Array(await source.slice(sourceOffset, sourceOffset + sourceLength).arrayBuffer()) : new Uint8Array();
    if (dictionary.length !== sourceLength) throw new Error('อ่าน ISO ต้นทางไม่ครบ');
    const target = new Uint8Array(targetLength), near = new Float64Array(4), same = new Float64Array(768);
    let nextNear = 0, written = 0;
    activity('ประมวลผลแพตช์',writtenTotal);
    while (instructions.p < instructions.end) {
      for (const [kind, fixedSize, mode] of CODE_TABLE[instructions.byte()]) {
        const size = fixedSize || instructions.integer();
        if (size <= 0 || size > targetLength - written) throw new Error('คำสั่งแพตช์เกินขนาดหน้าต่าง');
        if (kind === 'ADD') { const part = data.section(size); const literal=part.b.subarray(part.p, part.end); target.set(literal, written); written += size; }
        else if (kind === 'RUN') { target.fill(data.byte(), written, written + size); written += size; }
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
            const n = Math.min(count, sourceLength-address); target.set(dictionary.subarray(address,address+n), written); written += n; address += n; count -= n;
          }
          if (count) {
            const from = address - sourceLength;
            if (from < 0 || from >= written) throw new Error('COPY อ้างอิงข้อมูลที่ยังไม่มี');
            if (from+count <= written) { target.set(target.subarray(from,from+count),written); written += count; }
            else { for (let i=0;i<count;i++) target[written+i]=target[from+i]; written += count; }

          }
        }
      }
    }
    if (written !== targetLength || data.p !== data.end || addresses.p !== addresses.end) throw new Error('ถอดรหัสแพตช์ได้ข้อมูลไม่ครบ');
    if (checksum !== undefined && adler32(target) !== checksum) throw new Error('Checksum ของแพตช์ไม่ตรง');
    writtenTotal += targetLength; windowIndex++;
    yield {bytes:target, written:writtenTotal, windowIndex};
  }
  if (writtenTotal !== expectedSize) throw new Error('ขนาด ISO ปลายทางไม่ตรง');
  } finally { await r.close(); }
}
