const form = document.querySelector("form");
const file = document.querySelector("#source");
const button = document.querySelector("button");
const status = document.querySelector("#status");
const download = document.querySelector("#download");
let outputUrl;

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!file.files.length || button.disabled) return;
  download.hidden = true;
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  button.disabled = file.disabled = true;
  status.textContent = "กำลังเริ่มสร้างชุด rePatch";
  const worker = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
  function finish(message) {
    status.textContent = message;
    worker.terminate();
    button.disabled = file.disabled = false;
  }
  worker.onerror = () => finish("เปิดตัวแปะแพตช์ไม่สำเร็จ กรุณาโหลดหน้าใหม่");
  worker.onmessage = ({ data }) => {
    if (data.message) status.textContent = data.message;
    if (data.error) finish(data.error);
    if (data.zip) {
      outputUrl = URL.createObjectURL(data.zip);
      download.href = outputUrl;
      download.hidden = false;
      finish("ตรวจ SHA-256 ผ่านแล้ว ดาวน์โหลดชุด rePatch ได้เลย");
    }
  };
  worker.postMessage(file.files[0]);
});
