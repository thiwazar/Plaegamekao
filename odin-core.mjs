import {hashBlob} from './odin-sha256.mjs';

// Parse incrementally; COPY keeps references to local file slices, not whole-file RAM copies.
class Reader {
  constructor(stream) { this.reader=stream.getReader(); this.buf=new Uint8Array(); this.pos=0; }
  async take(n) {
    if(!Number.isSafeInteger(n)||n<0||n>16*1024*1024) throw Error('Invalid read size');
    const out=new Uint8Array(n); let p=0;
    while(p<n) {
      if(this.pos===this.buf.length) { const r=await this.reader.read(); if(r.done) throw Error('แพตช์ไม่ครบ'); this.buf=r.value; this.pos=0; }
      const count=Math.min(n-p,this.buf.length-this.pos); out.set(this.buf.subarray(this.pos,this.pos+count),p); this.pos+=count; p+=count;
    }
    return out;
  }
  async u32() { return new DataView((await this.take(4)).buffer).getUint32(0,true); }
  async u64() { const n=Number(new DataView((await this.take(8)).buffer).getBigUint64(0,true)); if(!Number.isSafeInteger(n))throw Error('Invalid offset'); return n; }
  async finish() { if(this.pos!==this.buf.length)throw Error('แพตช์มีข้อมูลเกิน'); const r=await this.reader.read(); if(!r.done)throw Error('แพตช์มีข้อมูลเกิน'); }
}
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function applyPatch(source,patch,entry,report=()=>{}) {
  if(patch.size!==entry.patch_size||await hashBlob(patch)!==entry.patch_sha256)throw Error('ข้อมูลแพตช์ไม่ผ่านการตรวจสอบ');
  const r=new Reader(patch.stream().pipeThrough(new DecompressionStream('gzip')));
  try {
    if(new TextDecoder().decode(await r.take(8))!=='OSDP0001')throw Error('รูปแบบแพตช์ไม่ถูกต้อง');
    if(await r.u64()!==entry.source_size||await r.u64()!==entry.target_size)throw Error('ขนาดในแพตช์ไม่ตรง');
    if(hex(await r.take(32))!==entry.source_sha256||hex(await r.take(32))!==entry.target_sha256)throw Error('แพตช์คนละรุ่น');
    const parts=[]; let size=0,ops=0;
    while(true) {
      const op=(await r.take(1))[0]; if(op===255)break;
      if(++ops>2000000)throw Error('จำนวนคำสั่งแพตช์เกินขอบเขต');
      if(op===0) {
        const offset=await r.u64(),n=await r.u32();
        if(n===0||offset+n>source.size||size+n>entry.target_size)throw Error('คำสั่งคัดลอกเกินขอบเขต');
        parts.push(source.slice(offset,offset+n)); size+=n;
      } else if(op===1) {
        let n=await r.u32(); if(n===0||size+n>entry.target_size)throw Error('ข้อมูลแพตช์เกินขอบเขต');
        size+=n; while(n) {const count=Math.min(n,1024*1024); parts.push(await r.take(count)); n-=count;}
      } else if(op===2) {
        const offset=await r.u64(),n=await r.u32();
        if(n===0||n>1024*1024||offset+n>source.size||size+n>entry.target_size)throw Error('Invalid XOR range');
        const base=new Uint8Array(await source.slice(offset,offset+n).arrayBuffer()),delta=await r.take(n);
        for(let i=0;i<n;i++)base[i]^=delta[i];
        parts.push(base);size+=n;
      } else throw Error('คำสั่งแพตช์ไม่ถูกต้อง');
      if(ops%100===0)report(size/entry.target_size);
    }
    await r.finish(); if(size!==entry.target_size)throw Error('ขนาดผลลัพธ์ไม่ครบ');
    return new Blob(parts,{type:'application/octet-stream'});
  } finally {try{await r.reader.cancel();}catch{} }
}
export async function verifySource(file,entry,report=()=>{}) {
  if(file.size!==entry.source_size)throw Error('ขนาดไฟล์ไม่ตรงกับต้นฉบับ PCSB00986 ที่รองรับ กรุณาใช้ไฟล์สำรองก่อนลงแพตช์');
  if(await hashBlob(file,report)!==entry.source_sha256)throw Error('ไฟล์ต้นฉบับไม่ตรงรุ่น หรือเคยถูกแก้ไขแล้ว กรุณาเลือกต้นฉบับที่ยังไม่ลงแพตช์');
}
