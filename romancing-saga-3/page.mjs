import { createPatch } from './patch.mjs';

const input = document.querySelector('#game');
const button = document.querySelector('#apply');
const choose = document.querySelector('#choose');
const selection = document.querySelector('#selection');
const status = document.querySelector('#status');
choose.addEventListener('click', () => input.click());
input.addEventListener('change', () => {
  const selected = input.files[0];
  button.disabled = !selected;
  selection.textContent = selected ? 'โฟลเดอร์ที่เลือก: ' + selected.webkitRelativePath.split('/')[0] : 'ยังไม่ได้เลือกโฟลเดอร์';
  status.textContent = selected ? 'พร้อมตรวจไฟล์และแปะแพตช์' : 'เลือกโฟลเดอร์เกมเพื่อเริ่ม';
});
button.addEventListener('click', async () => {
  input.disabled = button.disabled = choose.disabled = true;
  try {
    const files = [...input.files];
    const names = ['archive.psarc', 'Media/StreamingAssets/data.bin', 'Media/StreamingAssets/data.idx'];
    const originals = Object.fromEntries(names.map(name => {
      const found = files.filter(file => file.webkitRelativePath.endsWith('/' + name));
      if (found.length !== 1) throw new Error('หาไฟล์ต้นฉบับไม่พบหรือพบมากกว่าหนึ่งไฟล์: ' + name);
      return [name, found[0]];
    }));
    const zip = await createPatch(originals, message => { status.textContent = message; });
    const url = URL.createObjectURL(zip);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Romancing_SaGa_3_PCSE01337_Thai_rePatch_v1.0.zip';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = 'สร้าง ZIP rePatch สำเร็จ';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    input.disabled = choose.disabled = false;
    button.disabled = !input.files.length;
  }
});
