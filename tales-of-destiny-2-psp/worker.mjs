import {applyPatch} from './patcher.mjs';
self.onmessage=async e=>{try{const result=await applyPatch(e.data,{progress:p=>postMessage({progress:p}),log:text=>postMessage({text})});postMessage({result});}catch(e){postMessage({error:e.message});}};
