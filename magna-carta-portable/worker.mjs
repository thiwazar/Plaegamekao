import { patch } from './patcher.mjs';

async function response(name) {
  const result = await fetch(new URL(name, import.meta.url));
  if (!result.ok) throw new Error('ดาวน์โหลดข้อมูลเกมไม่สำเร็จ ลองใหม่อีกครั้ง');
  return result;
}

self.onmessage = async ({ data: source }) => {
  try {
    const manifest = await (await response('data/manifest.json')).json();
    let previous = '';
    const output = await patch(source, manifest, async name => (await response('data/' + name)).blob(),
      (phase, progress) => {
        const percent = Math.floor(progress * 100);
        const key = phase + percent;
        if (key !== previous) self.postMessage({ phase, percent });
        previous = key;
      });
    self.postMessage({ output });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
