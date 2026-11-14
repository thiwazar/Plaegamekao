const SOURCE='3f8c658eee1b35147672c597c0dbe8e36552172abf83571c52753eec9a50bcca';
const TARGET='93a08b0e61f4922bcd95f277c9b97e3dbdb3bd2225fb762554362ad62f4547c3';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export async function applyPatch(file, report=()=>{}) {
  if(file.size!==4589453312)throw Error('ขนาด ISO ไม่ตรงกับ Haunting Ground (USA) ที่รองรับ');
  const hash=await globalThis.hashwasm.createSHA256();
  async function digest(blob,start,end,label){
    hash.init();let last=-1;
    for(let at=0;at<blob.size;at+=4*1024*1024){
      hash.update(new Uint8Array(await blob.slice(at,at+4*1024*1024).arrayBuffer()));
      const p=Math.min(end,Math.floor(start+(end-start)*(at+4*1024*1024)/blob.size));
      if(p!==last){report(p,label);last=p;}
    }
    return hash.digest('hex');
  }
  if(await digest(file,0,35,'ตรวจสอบ ISO ต้นฉบับ')!==SOURCE)throw Error('SHA-256 ไม่ตรง: ต้องใช้ Haunting Ground (USA) เท่านั้น');
  const response=await fetch(new URL('./manifest.json',import.meta.url));
  if(!response.ok)throw Error('โหลดข้อมูลแพตช์ไม่สำเร็จ');
  const m=await response.json();
  if(m.format!=='HGWEB1'||m.sourceSha256!==SOURCE||m.targetSha256!==TARGET||m.sourceSize!==file.size||m.targetSize!==4589453312||!Array.isArray(m.ops)||!Array.isArray(m.bundles))throw Error('ข้อมูลรุ่นแพตช์ไม่ถูกต้อง');
  const parts=[];let total=0,active=-1,bundle=null;
  for(let i=0;i<m.ops.length;i++){
    const op=m.ops[i];let piece;
    if(op[0]==='copy'&&op.length===3&&integer(op[1])&&integer(op[2])&&op[1]+op[2]<=file.size)piece=file.slice(op[1],op[1]+op[2]);
    else if(op[0]==='zero'&&op.length===2&&integer(op[1])&&op[1]<=m.targetSize){
      const zeros=new Uint8Array(Math.min(op[1],1048576));let n=op[1];const chunks=[];
      while(n){const size=Math.min(n,zeros.length);chunks.push(zeros.subarray(0,size));n-=size;}piece=new Blob(chunks);
    }else if(op[0]==='data'&&op.length===6&&op.slice(1,5).every(integer)&&op[4]>0&&op[4]<=65536){
      const descriptor=m.bundles[op[1]];
      if(!descriptor||!/^payload-\d{3}\.dat$/.test(descriptor.url)||!integer(descriptor.length)||descriptor.length>4194304)throw Error('ข้อมูลชิ้นส่วนไม่ถูกต้อง');
      if(active!==op[1]){
        const r=await fetch(new URL(descriptor.url,import.meta.url));if(!r.ok)throw Error('โหลดชิ้นส่วนไม่สำเร็จ กรุณาลองใหม่');
        bundle=await r.blob();if(bundle.size!==descriptor.length||await digest(bundle,36,36,'ตรวจชิ้นส่วนแพตช์')!==descriptor.sha256)throw Error('ชิ้นส่วนแพตช์เสียหาย');active=op[1];
      }
      if(op[2]+op[3]>bundle.size)throw Error('ขอบเขตชิ้นส่วนไม่ถูกต้อง');
      piece=await new Response(bundle.slice(op[2],op[2]+op[3]).stream().pipeThrough(new DecompressionStream('deflate'))).blob();
      if(piece.size!==op[4]||await digest(piece,36,36,'ตรวจชิ้นส่วนแพตช์')!==op[5])throw Error('ข้อมูลหลังถอดรหัสไม่ถูกต้อง');
    }else throw Error('คำสั่งแพตช์ไม่ถูกต้อง');
    total+=piece.size;if(total>m.targetSize)throw Error('ผลลัพธ์เกินขนาดที่กำหนด');parts.push(piece);
    if(i%100===0)report(36+Math.floor(24*i/m.ops.length),'ประกอบไฟล์ภาษาไทย');
  }
  if(total!==m.targetSize)throw Error('ไฟล์ผลลัพธ์ไม่ครบ');
  const output=new Blob(parts,{type:'application/octet-stream'});
  if(await digest(output,60,100,'ตรวจสอบ ISO ภาษาไทย')!==TARGET)throw Error('ผลลัพธ์ไม่ตรงกับรุ่นที่เผยแพร่ จึงยกเลิกการดาวน์โหลด');
  report(100,'ตรวจสอบผ่าน — พร้อมดาวน์โหลด');return output;
}
