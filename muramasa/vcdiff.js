// Strict decoder for the published patches' RFC 3284 subset; arbitrary xdelta files are not accepted.
// COPY source data remains File/Blob slices, avoiding a whole-file JavaScript allocation.
export function applyDelta(source,bytes,expectedSize){
 let p=0;const parts=[];let total=0;
 function byte(){if(p>=bytes.length)throw Error('แพตช์ไม่ครบ');return bytes[p++];}
 function num(limit=bytes.length){let n=0,count=0,v;do{if(p>=limit||++count>8)throw Error('รูปแบบแพตช์ไม่ถูกต้อง');v=byte();n=n*128+(v&127);if(!Number.isSafeInteger(n))throw Error('ขนาดแพตช์ไม่ถูกต้อง');}while(v&128);return n;}
 for(const b of [0xd6,0xc3,0xc4,0,0])if(byte()!==b)throw Error('ไม่ใช่แพตช์รุ่นที่รองรับ');
 while(p<bytes.length){
  if(byte()!==1)throw Error('ไม่รองรับรูปแบบหน้าต่างแพตช์');
  const sourceSize=num(),sourceStart=num();if(sourceStart+sourceSize>source.size)throw Error('ไฟล์ต้นฉบับไม่ครบ');
  const deltaLength=num(),end=p+deltaLength;if(end>bytes.length)throw Error('แพตช์ไม่ครบ');
  const targetSize=num(end);if(byte()!==0)throw Error('ไม่รองรับการบีบอัดแพตช์นี้');
  const dataLength=num(end),instLength=num(end),addrLength=num(end),dataStart=p,instStart=p+dataLength,addrStart=instStart+instLength;
  if(addrStart+addrLength!==end)throw Error('ส่วนข้อมูลแพตช์ไม่ตรงกัน');
  let dp=dataStart,ip=instStart,ap=addrStart,produced=0;
  while(ip<addrStart){p=ip;const op=byte(),size=num(addrStart);ip=p;if(!size||produced+size>targetSize)throw Error('คำสั่งแพตช์เกินขอบเขต');
   if(op===1){if(dp+size>instStart)throw Error('ข้อความแพตช์ไม่ครบ');parts.push(bytes.slice(dp,dp+size));dp+=size;}
   else if(op===19){p=ap;const offset=num(end);ap=p;if(offset+size>sourceSize)throw Error('แพตช์อ้างอิงข้อมูลเกินไฟล์');parts.push(source.slice(sourceStart+offset,sourceStart+offset+size));}
   else throw Error('คำสั่งแพตช์รุ่นนี้ไม่รองรับ');
   produced+=size;
  }
  if(produced!==targetSize||dp!==instStart||ap!==end)throw Error('แพตช์สร้างข้อมูลไม่ครบ');
  total+=produced;if(total>expectedSize)throw Error('ขนาดผลลัพธ์เกินกำหนด');p=end;
 }
 if(total!==expectedSize)throw Error('ขนาดผลลัพธ์ไม่ตรง');
 return new Blob(parts,{type:'application/octet-stream'});
}
