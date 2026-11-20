import loadDecoder from "../xdelta3-big.js";
import { hashBlob } from "../odin-sha256.mjs";
import { makeZip } from "../repatch/core.mjs";

const sourceSize = 530607616;
const targetSize = 530888704;
const sourceHash = "77865263d448646169f02a83dbc785a9fdee24b58094d917d6520896752d98e0";
const targetHash = "bdfc1ae88cd13f484b2364bd69a64cfc147e438d40a572765ffafaec98c3b3b9";
const payloadHash = "b1435f10f89d211eb7a1a4b7d214972c826fdfc01e96e3030783a80aa919a6b5";
const report = message => self.postMessage({ message });

async function buildArc(file) {
  const response = await fetch("./translation.dat");
  if (!response.ok) throw new Error("โหลดข้อมูลคำแปลไม่สำเร็จ");
  const payload = await response.blob();
  if (await hashBlob(payload) !== payloadHash) throw new Error("ข้อมูลคำแปลเสียหาย");
  const delta = new Uint8Array(await payload.arrayBuffer());
  const decoder = await loadDecoder();
  const pointers = [];
  function allocate(size) {
    const ptr = decoder._malloc(size);
    if (!ptr) throw new Error("หน่วยความจำไม่พอ กรุณาลองใช้เบราว์เซอร์ 64 บิตบนคอมพิวเตอร์");
    pointers.push(ptr);
    return ptr;
  }
  try {
    const patch = allocate(delta.length);
    const source = allocate(sourceSize);
    const outputCapacity = targetSize + 50 * 1024 * 1024;
    const output = allocate(outputCapacity);
    const written = allocate(4);
    decoder.HEAPU8.set(delta, patch);
    let offset = 0;
    for await (const chunk of file.stream()) {
      decoder.HEAPU8.set(chunk, source + offset);
      offset += chunk.length;
    }
    const status = decoder._xd3_decode_memory(patch, delta.length, source, sourceSize,
      output, written, outputCapacity, 0);
    if (status || decoder.getValue(written, "i32") !== targetSize) {
      throw new Error("สร้างไฟล์ภาษาไทยไม่สำเร็จ (" + status + ")");
    }
    return new Blob([decoder.HEAPU8.subarray(output, output + targetSize)]);
  } finally {
    for (const ptr of pointers.reverse()) decoder._free(ptr);
  }
}

self.onmessage = async ({ data: file }) => {
  try {
    report("กำลังตรวจ SHA-256 ของไฟล์ต้นฉบับ");
    if (file.size !== sourceSize || await hashBlob(file) !== sourceHash) {
      throw new Error("กรุณาเลือก data.arc ต้นฉบับของเกม USA รหัส PCSE00909 ที่ถอดรหัสแล้ว");
    }
    report("กำลังสร้าง data.arc ภาษาไทย");
    const arc = await buildArc(file);
    report("กำลังตรวจ SHA-256 ของไฟล์ภาษาไทย");
    if (await hashBlob(arc) !== targetHash) throw new Error("ไฟล์ภาษาไทยไม่ผ่านการตรวจ SHA-256");
    report("กำลังจัด ZIP สำหรับ rePatch");
    const readme = new Blob([
      "Yomawari: Night Alone ภาษาไทย v1.0 | PS Vita USA PCSE00909\n",
      "เปิดใช้ปลั๊กอิน rePatch แล้วปิดเกม แตก ZIP และคัดลอกโฟลเดอร์ rePatch ไปไว้ที่ ux0:/\n",
      "ตำแหน่งไฟล์คือ ux0:rePatch/PCSE00909/data.arc\n",
      "หากต้องการถอนแพตช์ ให้นำไฟล์นี้ออกจากโฟลเดอร์ rePatch ขณะปิดเกม\n",
      "SHA-256 ของ data.arc: " + targetHash + "\n",
      "ตรวจไฟล์ผ่านแล้ว ยังไม่ได้ทดสอบบน PS Vita จริง\n"
    ]);
    const zip = await makeZip([
      { name: "rePatch/PCSE00909/data.arc", blob: arc },
      { name: "README_TH.txt", blob: readme }
    ]);
    self.postMessage({ zip });
  } catch (error) {
    self.postMessage({ error: error.message || "สร้างชุด rePatch ไม่สำเร็จ" });
  }
};
