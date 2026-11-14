importScripts('../vendor/sha256.umd.min.js');
self.onmessage=async({data})=>{
  try{
    const {applyPatch}=await import('./core.mjs');
    const output=await applyPatch(data.file,(percent,message)=>self.postMessage({percent,message}));
    self.postMessage({output});
  }catch(e){self.postMessage({error:e.message||String(e)});}
};
