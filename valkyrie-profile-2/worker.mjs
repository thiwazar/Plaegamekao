import '../vendor/sha256.umd.min.js';

const STEP = 8 * 1024 * 1024;

self.onmessage = async ({data}) => {
  const {id, blob} = data;
  try {
    const hasher = await self.hashwasm.createSHA256();
    hasher.init();
    for (let at = 0; at < blob.size; at += STEP) {
      hasher.update(new Uint8Array(await blob.slice(at, at + STEP).arrayBuffer()));
      self.postMessage({id, progress: Math.min(at + STEP, blob.size) / blob.size});
    }
    self.postMessage({id, hash: hasher.digest('hex')});
  } catch (error) {
    self.postMessage({id, error: error.message || String(error)});
  }
};
