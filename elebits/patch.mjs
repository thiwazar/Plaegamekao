import loadXdelta from '../xdelta3-big.js?v=20261025-1';

const sourceHash = '0524cea911d47d77e2c903b10b80871383818a9cb82c8f72091cb6dac7182523';
const targetHash = 'd68674e44311d5ae5f594cc4a80d8a109e25a129440833a9d0fc0f164b6184c9';
const patchHash = '5fcc2b586c125cabbf9461deffb22ccaf2ac6842338a3c9dca32b2e7b45c3093';
const sourceSize = 60695676;
const targetSize = 64774656;
const input = document.querySelector('#source-rom');
const status = document.querySelector('#patch-status');
const download = document.querySelector('#patched-rom');
let outputUrl;

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function applyPatch(source, patch) {
  const module = await loadXdelta({
    locateFile: name => new URL('../' + name + '?v=20261025-1', import.meta.url).href
  });
  const sourcePtr = module._malloc(source.length);
  const patchPtr = module._malloc(patch.length);
  const targetPtr = module._malloc(targetSize);
  const sizePtr = module._malloc(4);
  try {
    if (!sourcePtr || !patchPtr || !targetPtr || !sizePtr) throw new Error('หน่วยความจำไม่พอ');
    module.HEAPU8.set(source, sourcePtr);
    module.HEAPU8.set(patch, patchPtr);
    const result = module._xd3_decode_memory(patchPtr, patch.length, sourcePtr, source.length, targetPtr, sizePtr, targetSize, 0);
    if (result !== 0 || module.getValue(sizePtr, 'i32') !== targetSize) throw new Error('ถอดแพตช์ไม่สำเร็จ');
    return module.HEAPU8.slice(targetPtr, targetPtr + targetSize);
  } finally {
    for (const ptr of [sourcePtr, patchPtr, targetPtr, sizePtr]) module._free(ptr);
  }
}

input.addEventListener('change', async () => {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = undefined;
  download.hidden = true;
  const file = input.files[0];
  if (!file) return;
  input.disabled = true;
  status.textContent = 'กำลังตรวจ ROM ต้นฉบับ…';
  try {
    if (file.size !== sourceSize) throw new Error('ขนาดไฟล์ไม่ตรงกับ ROM UNDUB ที่รองรับ');
    const source = new Uint8Array(await file.arrayBuffer());
    if (await sha256(source) !== sourceHash) throw new Error('SHA-256 ไม่ตรงกับ ROM UNDUB ที่รองรับ');
    status.textContent = 'กำลังโหลดและแปะแพตช์…';
    const response = await fetch(new URL('Elebits_Thai_UNDUB_v1.0.xdelta', import.meta.url));
    if (!response.ok) throw new Error('โหลดไฟล์แพตช์ไม่สำเร็จ');
    const patch = new Uint8Array(await response.arrayBuffer());
    if (await sha256(patch) !== patchHash) throw new Error('SHA-256 ของไฟล์แพตช์ไม่ตรง');
    const output = await applyPatch(source, patch);
    if (await sha256(output) !== targetHash) throw new Error('SHA-256 ของไฟล์ผลลัพธ์ไม่ตรง');
    outputUrl = URL.createObjectURL(new Blob([output], { type: 'application/octet-stream' }));
    download.href = outputUrl;
    download.hidden = false;
    status.textContent = 'แปะแพตช์สำเร็จ ตรวจ SHA-256 แล้ว';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    input.disabled = false;
    input.value = '';
  }
});
