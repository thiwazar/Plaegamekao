import {mount} from './app.mjs?v=separate1';
import {GAMES} from './core.mjs';
for(const host of document.querySelectorAll('[data-repatch-game]')){
 const key=host.dataset.repatchGame,game=GAMES[key];
 if(!game)continue;
 const root=host.attachShadow({mode:'open'});
 try{
  const r=await fetch(new URL('./panel.html',import.meta.url));
  if(!r.ok)throw Error('โหลดเครื่องมือไม่สำเร็จ');
  root.innerHTML='<link rel="stylesheet" href="'+new URL('./style.css',import.meta.url)+'">'+await r.text();
  root.getElementById('title').textContent=game.name+' — สร้างชุด rePatch';
  root.getElementById('install-path').textContent='ux0:rePatch/'+game.id+'/';
  await mount(root,key);
 }catch(e){root.textContent=e.message;}
}
