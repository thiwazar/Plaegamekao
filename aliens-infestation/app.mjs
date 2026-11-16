const input = document.querySelector('#rom');
const apply = document.querySelector('#apply');
const status = document.querySelector('#status');
const download = document.querySelector('#download');
const date = document.querySelector('#release-date');
let objectUrl;

function clearResult() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
  download.hidden = true;
  download.removeAttribute('href');
}

const manifestResponse = await fetch('manifest.json');
const manifest = manifestResponse.ok ? await manifestResponse.json() : null;
if (manifest) {
  date.dateTime = manifest.published;
  date.textContent = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', dateStyle: 'long',
  }).format(new Date(manifest.published));
} else {
  status.textContent = 'โหลดข้อมูลแพตช์ไม่ได้ กรุณาโหลดหน้าใหม่';
}

input.addEventListener('change', () => {
  clearResult();
  const file = input.files[0];
  apply.disabled = !manifest || !file || !/\.nds$/i.test(file.name) || file.size !== manifest.sourceSize;
  status.className = apply.disabled && file ? 'error' : '';
  status.textContent = !file ? 'เลือกไฟล์ .nds เพื่อเริ่ม' :
    apply.disabled ? 'กรุณาเลือก ROM Europe ต้นฉบับ .nds ขนาด 32 MiB' : 'พร้อมตรวจไฟล์และสร้าง ROM ภาษาไทย';
});

apply.addEventListener('click', () => {
  if (apply.disabled) return;
  clearResult();
  apply.disabled = input.disabled = true;
  status.className = '';
  status.textContent = 'กำลังตรวจ ROM และโหลดข้อมูลแพตช์…';
  let worker;
  const finish = () => {
    worker?.terminate();
    apply.disabled = input.disabled = false;
  };
  const fail = (message) => {
    status.className = 'error';
    status.textContent = message;
    finish();
  };
  try {
    worker = new Worker('worker.mjs', { type: 'module' });
    worker.onerror = () => fail('ระบบแพตช์เริ่มทำงานไม่ได้ กรุณาโหลดหน้าใหม่');
    worker.onmessage = ({data}) => {
      if (data.type === 'error') return fail(data.text);
      if (data.type === 'progress') {
        status.textContent = data.text;
        return;
      }
      objectUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'application/octet-stream' }));
      download.href = objectUrl;
      download.download = 'Aliens_Infestation_Europe_Thai_v1.0.nds';
      download.hidden = false;
      status.textContent = 'สร้าง ROM ภาษาไทยสำเร็จและตรวจ SHA-256 ผ่านแล้ว';
      finish();
      download.focus();
    };
    worker.postMessage({ file: input.files[0], manifest });
  } catch {
    fail('ระบบแพตช์เริ่มทำงานไม่ได้ กรุณาโหลดหน้าใหม่');
  }
});
