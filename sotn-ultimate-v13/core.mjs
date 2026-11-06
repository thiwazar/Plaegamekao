const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
function crc(bytes,c=0xffffffff){for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return c;}
export async function inspectBlob(blob,progress=()=>{}){
 const h=await globalThis.hashwasm.createSHA256();h.init();let c=0xffffffff,done=0;
 for(let offset=0;offset<blob.size;offset+=4*1024*1024){const bytes=new Uint8Array(await blob.slice(offset,offset+4*1024*1024).arrayBuffer());h.update(bytes);c=crc(bytes,c);done+=bytes.length;progress(done/blob.size);}
 return {sha256:h.digest(),crc32:(c^0xffffffff)>>>0};
}
export async function patchGame(file,patch,manifest,progress=()=>{}){
 if(file.size!==manifest.sourceSize)throw Error('ขนาด BIN ไม่ตรง ต้องใช้ Ultimate PS1 v1.3 ต้นฉบับ 684,653,088 ไบต์');
 progress('กำลังตรวจ SHA-256 ของ BIN ต้นฉบับ…');
 const source=await inspectBlob(file);
 if(source.sha256!==manifest.sourceSha256)throw Error('BIN ไม่ตรงกับ Ultimate PS1 v1.3 ที่รองรับ ไม่สามารถใช้เกมรุ่นอื่นหรือไฟล์ไทยรุ่นก่อน');
 if(patch.length!==manifest.patchSize||(await inspectBlob(new Blob([patch]))).sha256!==manifest.patchSha256)throw Error('แพตช์เสียหาย กรุณาโหลดหน้าใหม่');
 const end=patch.length-12;
 if(end<7||String.fromCharCode(...patch.subarray(0,4))!=='BPS1')throw Error('รูปแบบแพตช์ไม่ถูกต้อง');
 const view=new DataView(patch.buffer,patch.byteOffset,patch.byteLength);
 if(((crc(patch.subarray(0,-4))^0xffffffff)>>>0)!==view.getUint32(patch.length-4,true))throw Error('CRC แพตช์ไม่ตรง');
 if(source.crc32!==view.getUint32(end,true))throw Error('CRC ต้นฉบับไม่ตรง');
 let p=4;
 function number(){let value=0,shift=1;for(let n=0;n<8;n++){if(p>=end)throw Error('แพตช์ไม่ครบ');const b=patch[p++];value+=(b&127)*shift;if(!Number.isSafeInteger(value))throw Error('ตัวเลขแพตช์ไม่ถูกต้อง');if(b&128)return value;shift*=128;value+=shift;}throw Error('รหัสแพตช์ยาวเกินกำหนด');}
 const sourceSize=number(),targetSize=number(),metadata=number();
 if(sourceSize!==file.size||targetSize!==manifest.targetSize||p+metadata>end)throw Error('ข้อมูลแพตช์ไม่ตรงกับรุ่นเกม');p+=metadata;
 progress('กำลังสร้าง BIN ภาษาไทยภายในเครื่อง…');let pos=0;const pieces=[];
 while(p<end){const action=number(),mode=action%4,length=Math.floor(action/4)+1;if(pos+length>targetSize)throw Error('ข้อมูลเกินขนาดไฟล์');
  if(mode===0){if(pos+length>file.size)throw Error('ข้อมูลต้นฉบับไม่ครบ');pieces.push(file.slice(pos,pos+length));}
  else if(mode===1){if(p+length>end)throw Error('แพตช์ไม่ครบ');pieces.push(patch.slice(p,p+length));p+=length;}
  else throw Error('คำสั่ง BPS นี้ไม่รองรับในแพตช์รุ่นนี้');pos+=length;
 }
 if(pos!==targetSize||p!==end)throw Error('ขนาดผลลัพธ์ไม่ถูกต้อง');
 const output=new Blob(pieces,{type:'application/octet-stream'});
 progress('กำลังตรวจ SHA-256 ของ BIN ภาษาไทย…');const result=await inspectBlob(output);
 if(output.size!==manifest.targetSize||result.sha256!==manifest.targetSha256||result.crc32!==view.getUint32(end+4,true))throw Error('ผลลัพธ์ไม่ผ่านการตรวจ จึงไม่เปิดดาวน์โหลด');
 return output;
}
