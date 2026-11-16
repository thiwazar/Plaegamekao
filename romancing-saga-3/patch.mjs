import loadDecoder from '../xdelta3-big.js';

const blockSize = 65536;
const asset = path => fetch(new URL(path, import.meta.url)).then(response => {
  if (!response.ok) throw new Error('โหลดข้อมูลแพตช์ไม่สำเร็จ: ' + path);
  return response;
});

async function verify(blob, size, sha, label) {
  if (blob.size !== size) throw new Error('ขนาดไฟล์ไม่ตรง: ' + label);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== sha) throw new Error('SHA-256 ไม่ตรง: ' + label);
}

async function decode(module, source, patch, expectedSize) {
  const pointers = [];
  function allocate(size) {
    const pointer = module._malloc(size);
    if (!pointer) throw new Error('หน่วยความจำไม่เพียงพอ');
    pointers.push(pointer);
    return pointer;
  }
  try {
    const input = allocate(patch.byteLength);
    const base = allocate(source.size);
    const output = allocate(expectedSize);
    const sizePointer = allocate(4);
    module.HEAPU8.set(new Uint8Array(patch), input);
    let offset = base;
    for await (const chunk of source.stream()) {
      module.HEAPU8.set(chunk, offset);
      offset += chunk.length;
    }
    const code = module._xd3_decode_memory(input, patch.byteLength, base, source.size,
      output, sizePointer, expectedSize, 0);
    if (code !== 0) throw new Error('ตัวถอดรหัสแจ้งข้อผิดพลาด ' + code);
    const size = module.getValue(sizePointer, 'i32');
    if (size !== expectedSize) throw new Error('ขนาดผลลัพธ์จากตัวถอดรหัสไม่ตรง');
    return new Blob([module.HEAPU8.subarray(output, output + size)]);
  } finally {
    for (const pointer of pointers.reverse()) module._free(pointer);
  }
}

async function applyMember(module, source, spec, label, fetchAsset) {
  await verify(source, spec.sourceSize, spec.sourceHash, label);
  const delta = await (await fetchAsset(spec.patch)).arrayBuffer();
  const target = spec.append ? new Blob([source, delta]) : await decode(module, source, delta, spec.targetSize);
  await verify(target, spec.targetSize, spec.targetHash, label);
  return target;
}

const read40 = (view, offset) => view.getUint8(offset) * 2 ** 32 + view.getUint32(offset + 1);
function write40(view, offset, value) {
  view.setUint8(offset, Math.floor(value / 2 ** 32));
  view.setUint32(offset + 1, value % 2 ** 32);
}

async function transform(blob, stream) {
  return new Response(blob.stream().pipeThrough(stream)).blob();
}

async function patchArchive(module, source, spec, status, fetchAsset) {
  await verify(source, spec.sourceSize, spec.sourceHash, 'archive.psarc');
  const header = new DataView(await source.slice(0, 32).arrayBuffer());
  if (header.getUint32(0) !== 0x50534152 || header.getUint32(8) !== 0x7a6c6962 ||
      header.getUint32(16) !== 30 || header.getUint32(24) !== blockSize) {
    throw new Error('รูปแบบ PSARC ไม่ตรงกับฐานเกม');
  }
  const count = header.getUint32(20);
  const tableStart = 32 + count * 30;
  const toc = new DataView(await source.slice(0, header.getUint32(12)).arrayBuffer());
  const entries = [];
  for (let i = 0; i < count; i++) {
    const at = 32 + i * 30;
    let number = toc.getUint32(at + 16);
    let size = read40(toc, at + 20);
    let offset = read40(toc, at + 25);
    let blocks = [];
    for (let begin = 0; begin < size; begin += blockSize) {
      const length = toc.getUint16(tableStart + number++ * 2) || blockSize;
      blocks.push(source.slice(offset, offset + length));
      offset += length;
    }
    if (spec.members[i]) {
      status('กำลังปรับทรัพยากรเกม…');
      const raw = [];
      for (let j = 0; j < blocks.length; j++) {
        const expected = Math.min(blockSize, size - j * blockSize);
        raw.push(blocks[j].size === expected ? blocks[j] : await transform(blocks[j], new DecompressionStream('deflate')));
      }
      const updated = await applyMember(module, new Blob(raw), spec.members[i], 'PSARC ' + i, fetchAsset);
      size = updated.size;
      blocks = [];
      for (let start = 0; start < size; start += blockSize) {
        const part = updated.slice(start, start + blockSize);
        const compressed = await transform(part, new CompressionStream('deflate'));
        blocks.push(compressed.size < part.size ? compressed : part);
      }
    }
    entries.push({size, blocks});
  }
  const tocSize = tableStart + 2 * entries.reduce((sum, entry) => sum + entry.blocks.length, 0);
  const bytes = new Uint8Array(tocSize);
  bytes.set(new Uint8Array(toc.buffer, 0, tableStart));
  const output = new DataView(bytes.buffer);
  output.setUint32(12, tocSize);
  let offset = tocSize;
  let block = 0;
  const parts = [bytes];
  for (const [i, entry] of entries.entries()) {
    const at = 32 + i * 30;
    output.setUint32(at + 16, block);
    write40(output, at + 20, entry.size);
    write40(output, at + 25, offset);
    for (const part of entry.blocks) {
      output.setUint16(tableStart + 2 * block++, part.size % blockSize);
      offset += part.size;
      parts.push(part);
    }
  }
  return new Blob(parts);
}

const crcTable = Uint32Array.from({length: 256}, (_, crc) => {
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});

async function storedZip(files) {
  const parts = [], central = [];
  let offset = 0, directorySize = 0;
  for (const [path, blob] of files) {
    const name = new TextEncoder().encode(path);
    let crc = 0xffffffff;
    for await (const chunk of blob.stream()) for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    crc = (crc ^ 0xffffffff) >>> 0;
    const file = new DataView(new ArrayBuffer(30 + name.length));
    file.setUint32(0, 0x04034b50, true);
    file.setUint16(4, 20, true);
    file.setUint16(12, 0x21, true);
    file.setUint32(14, crc, true);
    file.setUint32(18, blob.size, true);
    file.setUint32(22, blob.size, true);
    file.setUint16(26, name.length, true);
    new Uint8Array(file.buffer).set(name, 30);
    const entry = new DataView(new ArrayBuffer(46 + name.length));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    new Uint8Array(entry.buffer).set(new Uint8Array(file.buffer, 4, 26), 6);
    entry.setUint32(42, offset, true);
    new Uint8Array(entry.buffer).set(name, 46);
    parts.push(file.buffer, blob);
    central.push(entry.buffer);
    offset += file.byteLength + blob.size;
    directorySize += entry.byteLength;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], {type:'application/zip'});
}

export async function createPatch(originals, status, options = {}) {
  const fetchAsset = options.fetchAsset ?? asset;
  status('กำลังตรวจไฟล์ต้นฉบับ…');
  const manifest = await (await fetchAsset('manifest.json')).json();
  const module = await loadDecoder(options.decoder);
  const root = 'rePatch/PCSE01337/';
  const files = [[root + 'archive.psarc', await patchArchive(module, originals['archive.psarc'], manifest.archive, status, fetchAsset)]];
  for (const name of ['data.bin', 'data.idx']) {
    const path = 'Media/StreamingAssets/' + name;
    status('กำลังแปะแพตช์ ' + name + '…');
    files.push([root + path, await applyMember(module, originals[path], manifest[name], name, fetchAsset)]);
  }
  for (const name of ['README_TH.txt', 'NotoSansThai-OFL.txt']) files.push([name, await (await fetchAsset(name)).blob()]);
  status('กำลังจัด ZIP rePatch…');
  return storedZip(files);
}
