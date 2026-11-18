import '../vendor/sha256.umd.min.js';
import {patchGame} from './core.mjs';
self.onmessage=async({data})=>{try{const blob=await patchGame(data.file,new Uint8Array(data.patch),data.manifest,text=>self.postMessage({type:'progress',text}));self.postMessage({type:'done',blob});}catch(error){self.postMessage({type:'error',text:error.message});}};
