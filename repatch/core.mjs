export const GAMES={
 muramasa:{name:'Muramasa Rebirth',id:'PCSE00240',version:'1.06',manifest:'../muramasa/patches/manifest.json',assets:'../muramasa/',format:'vcdiff',note:'ใช้เกมอัปเดต 1.06 ไม่รวม DLC แยกใน addcont'},
 odin:{name:'Odin Sphere Leifthrasir',id:'PCSB00986',version:'ฐานตาม SHA-256 ใน manifest',manifest:'../odin-manifest.json',assets:'../',format:'osdp',note:'ชุดเดิมรองรับ Vita3K Windows เท่านั้น ชุด rePatch นี้เป็นการทดลอง ยังไม่ยืนยัน eboot บน Vita จริง'},
 dragon:{name:'Dragon’s Crown',id:'PCSE00019',version:'1.00',manifest:'../dragons-crown/dragon-manifest.json',assets:'../dragons-crown/',format:'osdp',note:'แพตช์ draft 0.2 ยังไม่ยืนยัน eboot และการตั้งชื่อภาษาไทยบน Vita จริง'}
};
export function matchFiles(files,entries,titleId){
 const chosen=[];
 for(const entry of entries){
  const found=files.filter(f=>f.name===entry.name);
  if(found.length!==1)throw Error(found.length?`พบ ${entry.name} ซ้ำ ให้เลือกเฉพาะโฟลเดอร์เกมเดียว`:`ไม่พบ ${entry.name}`);
  const f=found[0],path=f.webkitRelativePath||f.name;
  const ids=path.split('/').filter(x=>/^PCS[A-Z]\d{5}$/.test(x));
  if(ids.some(x=>x!==titleId))throw Error(`โฟลเดอร์คนละ Title ID: ${path}`);
  if(f.webkitRelativePath&&path.split('/').length!==2)throw Error(`เลือกโฟลเดอร์ที่มี ${entry.name} อยู่ชั้นแรก ไม่เลือก ux0 หรือ app ทั้งหมด`);
  chosen.push(f);
 }
 return chosen;
}
export function target(entry){return {size:entry.targetSize??entry.target_size,hash:entry.targetSha256??entry.target_sha256};}
export function readme(game,release){return `แปลโดย เพจแปลเกมเก่า\n${game.name} / ${game.id}\nฐานเกม: ${game.version}\nแพตช์: ${release}\n\nสถานะ: ชุด rePatch ทดลอง — ยังไม่ยืนยันการเปิดเกม/เซฟ/เล่นจบบน Vita จริง\n${game.note}\n\nติดตั้ง: ต้องเปิดใช้ปลั๊กอิน rePatch ที่รองรับเครื่องของคุณก่อน ปิดเกมแล้วคัดลอกโฟลเดอร์ rePatch ไปไว้ที่ ux0: ให้ได้ ux0:rePatch/${game.id}/ ไม่ซ้อน rePatch สองชั้น สำรองโฟลเดอร์ rePatch เดิมก่อนรวมไฟล์ ห้ามลบ app/patch/savedata\nเกมและอัปเดตเดิมต้องติดตั้งอยู่แล้ว rePatch ไม่ได้ติดตั้งอัปเดตให้\nถอนชุดทดลอง: ย้ายโฟลเดอร์ rePatch/${game.id} ออกแล้วคืนชุด rePatch เดิมที่สำรองไว้ ไม่ต้องแก้เซฟ\n\nตรวจทั้งหน้าเมนู บทพูด ฟอนต์ โหลดฉาก และบันทึก/โหลดเซฟสำรอง หากค้างให้คืนชุดเดิม\nไฟล์ในชุดนี้สร้างจากไฟล์ของผู้ใช้และตรวจ SHA-256 แล้ว ไม่ใช่ผลยืนยันเครื่องจริง\nคู่มือ: https://github.com/TheRadziu/NoNpDRM-modding/wiki\nปลั๊กอิน: https://github.com/dots-tb/rePatch-reDux0\n`;}
const table=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i>>>1)^((i&1)?0xedb88320:0);return i>>>0;});
export async function crc32(blob){let crc=0xffffffff;for(let p=0;p<blob.size;p+=1048576){for(const b of new Uint8Array(await blob.slice(p,p+1048576).arrayBuffer()))crc=table[(crc^b)&255]^(crc>>>8);}return (crc^0xffffffff)>>>0;}
export async function makeZip(entries,progress=()=>{}){
 const data=[],central=[];let offset=0,centralSize=0;const names=new Set();
 for(let index=0;index<entries.length;index++){
  const {name,blob}=entries[index];
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||names.has(name))throw Error('ชื่อไฟล์ ZIP ไม่ปลอดภัยหรือซ้ำ');
  names.add(name);const n=new TextEncoder().encode(name);
  if(n.length>65535||blob.size>=0xffffffff||offset+blob.size+n.length+30>=0xffffffff)throw Error('ชุดไฟล์เกินขนาด ZIP ที่รองรับ');
  progress(index/entries.length);const crc=await crc32(blob);
  const local=new Uint8Array(30),l=new DataView(local.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);
  l.setUint32(14,crc,true);l.setUint32(18,blob.size,true);l.setUint32(22,blob.size,true);l.setUint16(26,n.length,true);
  const c=new Uint8Array(46),v=new DataView(c.buffer);
  v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);
  v.setUint32(16,crc,true);v.setUint32(20,blob.size,true);v.setUint32(24,blob.size,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);
  data.push(local,n,blob);central.push(c,n);centralSize+=46+n.length;offset+=30+n.length+blob.size;
 }
 if(entries.length>65535||offset+centralSize+22>=0xffffffff)throw Error('ZIP ใหญ่เกินรองรับ');
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);progress(1);
 return new Blob([...data,...central,end],{type:'application/zip'});
}
