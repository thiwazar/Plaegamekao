import {patchRom} from './core.mjs';
self.onmessage=async ({data:{file,patch,manifest}})=>{
  try {
    if(file.size!==manifest.sourceSize)throw new Error('กรุณาใช้ ROM Final Fantasy IV (USA) [UNDUB] .nds ขนาด 132,208,128 ไบต์');
    const output=await patchRom(new Uint8Array(await file.arrayBuffer()),new Uint8Array(patch),manifest,text=>self.postMessage({type:'progress',text}));
    self.postMessage({type:'done',buffer:output.buffer},[output.buffer]);
  } catch(error) {self.postMessage({type:'error',text:error.message});}
};
