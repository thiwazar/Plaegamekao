import {applyPatch} from './patcher.mjs';
self.onmessage=async({data:{file,variant}})=>{
  try{
    const patchUrl=new URL(variant.patch,import.meta.url);
    patchUrl.searchParams.set('v',variant.patchSha256);
    const response=await fetch(patchUrl);
    if(!response.ok)throw Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    const result=await applyPatch(file,variant,new Uint8Array(await response.arrayBuffer()),(message,progress)=>self.postMessage({message,progress}));
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
