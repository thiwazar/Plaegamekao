const input = document.querySelector("#rom");
const apply = document.querySelector("#apply");
const download = document.querySelector("#download");
const status = document.querySelector("#status");
let output;

async function sha256(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchAsset(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("โหลดข้อมูลแพตช์ไม่สำเร็จ");
  return response;
}

async function patchRom(file) {
  const manifest = await (await fetchAsset("manifest.json")).json();
  if (file.size !== manifest.sourceSize) throw new Error("ขนาด ROM ไม่ตรงกับDream of Five v1.7.6");
  const source = new Uint8Array(await file.arrayBuffer());
  if (await sha256(source) !== manifest.sourceSha256) throw new Error("SHA-256 ไม่ตรงกับ ROM Dream of Five v1.7.6 ที่รองรับ");

  const compressed = await (await fetchAsset("thai-176.dat")).arrayBuffer();
  if (await sha256(compressed) !== manifest.payloadSha256) throw new Error("ข้อมูลแพตช์เสียหาย");
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const data = await new Response(stream).arrayBuffer();
  const view = new DataView(data);
  if (data.byteLength !== manifest.decodedSize ||
      new TextDecoder().decode(new Uint8Array(data, 0, 8)) !== "DOF176T\0") {
    throw new Error("รูปแบบข้อมูลแพตช์ไม่ถูกต้อง");
  }
  const result = new Uint8Array(manifest.targetSize);
  result.set(source);
  let cursor = 8;
  let previousEnd = 0;
  while (cursor < view.byteLength) {
    if (view.byteLength - cursor < 8) throw new Error("ข้อมูลแพตช์ขาดหาย");
    const offset = view.getUint32(cursor, true);
    const length = view.getUint32(cursor + 4, true);
    cursor += 8;
    if (!length || offset < previousEnd || offset + length > result.length || cursor + length > view.byteLength) {
      throw new Error("ตำแหน่งข้อมูลแพตช์ไม่ถูกต้อง");
    }
    result.set(new Uint8Array(data, cursor, length), offset);
    previousEnd = offset + length;
    cursor += length;
  }
  if (await sha256(result) !== manifest.targetSha256) throw new Error("ตรวจ SHA-256 ของผลลัพธ์ไม่ผ่าน");
  return new Blob([result], {type: "application/octet-stream"});
}

input.addEventListener("change", () => {
  output = undefined;
  download.hidden = true;
  apply.disabled = !input.files.length;
  status.textContent = input.files.length ? "พร้อมตรวจ ROM ต้นฉบับ" : "เลือก ROM ต้นฉบับเพื่อเริ่ม";
});

apply.addEventListener("click", async () => {
  const [file] = input.files;
  if (!file) return;
  input.disabled = apply.disabled = true;
  download.hidden = true;
  output = undefined;
  status.textContent = "กำลังตรวจและแปะแพตช์…";
  try {
    output = await patchRom(file);
    download.hidden = false;
    status.textContent = "สร้าง ROM ภาษาไทย และตรวจ SHA-256 ผ่านแล้ว";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    input.disabled = apply.disabled = false;
  }
});

download.addEventListener("click", () => {
  if (!output) return;
  const url = URL.createObjectURL(output);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Fire_Emblem_Dream_of_Five_v1.7.6_Thai.gba";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
