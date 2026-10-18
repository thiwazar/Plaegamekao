import {RELEASE} from './core.mjs?v=android-1';
const DIRECTORY='siren2-v1-mobile';
export const MOBILE_LOCK='siren2-v1-mobile-output';
export async function mobileDirectory(){return (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY,{create:true});}
export async function clearMobileOutput(){
  const dir=await mobileDirectory();
  for(const name of ['complete.json','output.iso'])try{await dir.removeEntry(name);}catch(e){if(e.name!=='NotFoundError')throw e;}
}
export async function checkMobileSpace(){
  const {quota,usage}=await navigator.storage.estimate();
  if(Number.isFinite(quota)&&Number.isFinite(usage)&&quota-usage<RELEASE.targetSize+64*1024*1024)throw Error('พื้นที่ที่เบราว์เซอร์ใช้ได้ไม่พอ กรุณาเพิ่มพื้นที่ว่าง หรือใช้ Chrome บนคอมพิวเตอร์');
}
export async function prepareMobileOutput(){
  await clearMobileOutput();await checkMobileSpace();
  return (await mobileDirectory()).getFileHandle('output.iso',{create:true});
}
export async function markMobileComplete(){
  const handle=await (await mobileDirectory()).getFileHandle('complete.json',{create:true});
  const writer=await handle.createWritable();
  await writer.write(JSON.stringify({size:RELEASE.targetSize,sha256:RELEASE.targetSha256}));await writer.close();
}
export async function getMobileOutput(){
  try{
    const dir=await mobileDirectory();
    const metadata=JSON.parse(await (await (await dir.getFileHandle('complete.json')).getFile()).text());
    if(metadata.size!==RELEASE.targetSize||metadata.sha256!==RELEASE.targetSha256)return null;
    const file=await (await dir.getFileHandle('output.iso')).getFile();
    return file.size===RELEASE.targetSize?file:null;
  }catch(e){if(e.name==='NotFoundError'||e instanceof SyntaxError)return null;throw e;}
}
