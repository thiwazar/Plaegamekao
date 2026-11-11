import {patchRom} from './core.mjs';

const input = document.querySelector('#source');
const button = document.querySelector('#patch');
const download = document.querySelector('#download');
const status = document.querySelector('#status');
let url;

function clearDownload() {
  if (url) URL.revokeObjectURL(url);
  url = undefined;
  download.removeAttribute('href');
  download.hidden = true;
}

input.addEventListener('change', () => {
  clearDownload();
  button.disabled = !input.files.length;
  status.textContent = input.files[0]?.name ?? 'เลือก ROM English v1.1 เพื่อเริ่ม';
});

button.addEventListener('click', async () => {
  const file = input.files[0];
  if (!file) return;
  clearDownload();
  input.disabled = button.disabled = true;
  status.textContent = 'กำลังตรวจ ROM และแปะแพตช์…';
  try {
    url = URL.createObjectURL(await patchRom(file));
    download.href = url;
    download.hidden = false;
    status.textContent = 'ตรวจ SHA-256 ผ่าน พร้อมดาวน์โหลด ROM ภาษาไทย v1.0';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    input.disabled = button.disabled = false;
  }
});

window.addEventListener('pagehide', clearDownload);
