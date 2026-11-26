export async function applyGauntletPatch(file, game, progress, log, hashBlob, sha256Hex) {
  if (file.size !== game.sourceSize) throw new Error("ขนาด BIN ต้นฉบับไม่ตรง");
  log("กำลังตรวจสอบ SHA-256 ของ BIN ต้นฉบับ…");
  if (await hashBlob(file, ratio => progress(5 + Math.round(ratio * 30))) !== game.sourceSha256) {
    throw new Error("SHA-256 ของ BIN ไม่ตรงกับรุ่นที่รองรับ");
  }

  const manifestUrl = new URL(game.patchUrl, location.href);
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) throw new Error("โหลดข้อมูลแพตช์ไม่สำเร็จ");
  const manifest = await manifestResponse.json();
  if (manifest.format !== "PGK-GAUNTLET-1" || manifest.sourceSha256 !== game.sourceSha256 ||
      manifest.targetSha256 !== game.targetSha256 || manifest.targetSize !== game.targetSize) {
    throw new Error("ข้อมูลแพตช์ไม่ตรงกับรุ่นที่เลือก");
  }
  log("กำลังโหลดข้อมูลการเปลี่ยนแปลง…");
  const response = await fetch(new URL("changes.dat", manifestUrl));
  if (!response.ok) throw new Error("โหลดข้อมูลการเปลี่ยนแปลงไม่สำเร็จ");
  const compressed = await response.arrayBuffer();
  if (await sha256Hex(compressed) !== manifest.dataSha256) throw new Error("ข้อมูลการเปลี่ยนแปลงเสียหาย");

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const changes = await new Response(stream).arrayBuffer();
  const view = new DataView(changes);
  const segments = [];
  let cursor = 0;
  let index = 0;
  while (index < changes.byteLength) {
    if (index + 8 > changes.byteLength) throw new Error("ข้อมูลแพตช์ไม่ครบ");
    const offset = view.getUint32(index, true);
    const length = view.getUint32(index + 4, true);
    index += 8;
    if (!length || offset < cursor || offset + length > game.targetSize ||
        (offset > cursor && offset > file.size) || index + length > changes.byteLength) {
      throw new Error("ช่วงข้อมูลแพตช์ไม่ถูกต้อง");
    }
    if (offset > cursor) segments.push(file.slice(cursor, offset));
    segments.push(new Uint8Array(changes, index, length));
    index += length;
    cursor = offset + length;
  }
  if (cursor < file.size) segments.push(file.slice(cursor));
  const output = new Blob(segments, {type: "application/octet-stream"});
  if (output.size !== game.targetSize) throw new Error("ขนาด BIN ภาษาไทยไม่ตรง");
  log("กำลังตรวจสอบ SHA-256 ของ BIN ภาษาไทย…");
  if (await hashBlob(output, ratio => progress(55 + Math.round(ratio * 45))) !== game.targetSha256) {
    throw new Error("SHA-256 ของ BIN ภาษาไทยไม่ตรง");
  }
  log("SHA-256 ผลลัพธ์ตรงกัน · แปะสำเร็จ", "ok");
  progress(100);
  return output;
}
