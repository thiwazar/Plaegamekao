import {applyPatch} from './patcher.mjs';
self.onmessage=async({data:{file,variant}})=>{
  try{
    const response=await fetch(new URL(variant.patch,import.meta.url));
    if(!response.ok)throw Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    const result=await applyPatch(file,variant,new Uint8Array(await response.arrayBuffer()),(message,progress)=>self.postMessage({message,progress}));
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
