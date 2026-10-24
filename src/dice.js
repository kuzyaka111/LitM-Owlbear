import {createDiceSound} from './dice-sound.js';
export function rollD6(crypto=globalThis.crypto){const a=new Uint32Array(1),limit=4294967292;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%6+1;}
export const describeRoll=total=>total>=10?'Успех':total>=7?'Успех с последствием':'Последствие';
export async function openDiceTray(root,{bonus,animated,sacrifice=false,onFirstResult=()=>{}}, {loadRenderer=()=>import('./dice-renderer.js')}={}){
 const doc=root.ownerDocument,win=doc.defaultView;
 const dialog=doc.createElement('dialog');dialog.className='mt-dice-dialog';dialog.setAttribute('aria-label','Лоток броска');
 const layout=doc.createElement('div');layout.className='mt-dice-layout';
 const tray=doc.createElement('div');tray.className='mt-physical-tray';tray.textContent=animated?'Загрузка костей…':'';
 const info=doc.createElement('section');info.className='mt-dice-info';
 const heading=doc.createElement('h2');heading.textContent='Результат броска';
 const total=doc.createElement('output');total.className='mt-roll-result';total.setAttribute('aria-live','polite');
 const formula=doc.createElement('p'),outcome=doc.createElement('p'),hint=doc.createElement('p');hint.className='mt-dice-hint';hint.textContent='Переброс обеих костей — если разрешён правилом. Новый результат заменяет прежний.'+(animated?' Потяните кость и отпустите или нажмите кнопку.':'');
 const reroll=doc.createElement('button');reroll.textContent='Перебросить обе кости';reroll.className='mt-dice-reroll';reroll.disabled=true;
 const close=doc.createElement('button');close.textContent='Закрыть';close.className='mt-dice-close';
 info.append(heading,total,formula,outcome,hint,reroll,close);layout.append(tray,info);dialog.append(layout);root.append(dialog);dialog.showModal();
 let renderer,closed=false,reported=false;const sound=animated?createDiceSound(win):null;
 const start=()=>{if(closed)return;total.textContent='…';formula.textContent='Бросок 2д6';outcome.textContent='';reroll.disabled=true;};
 function result(values){if(closed)return;const sum=values[0]+values[1]+bonus;total.textContent=String(sum);formula.textContent=`${values[0]} + ${values[1]} ${bonus<0?'−':'+'} ${Math.abs(bonus)} = ${sum}`;outcome.textContent=sacrifice?(sum>=10?'Чудо':sum>=7?'Судьба':'Напрасно'):describeRoll(sum);reroll.disabled=false;if(!reported){reported=true;onFirstResult();}}
 function simple(){const values=[rollD6(),rollD6()];tray.replaceChildren(...values.map(value=>{const d=doc.createElement('span');d.className='mt-static-die';d.textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][value-1];d.setAttribute('aria-label',String(value));return d;}));result(values);}
 const finished=new Promise(resolve=>{
  function finish(){if(closed)return;closed=true;try{sound?.dispose();renderer?.dispose();}finally{dialog.close();dialog.remove();win.removeEventListener('pagehide',finish);resolve();}}
  close.addEventListener('click',finish);dialog.addEventListener('cancel',e=>e.preventDefault());win.addEventListener('pagehide',finish,{once:true});
 });
 function fallback(){
  if(closed)return;
  renderer?.dispose();renderer=null;
  tray.textContent='Не удалось запустить 3D.';
  hint.textContent='Анимация недоступна. Нажмите кнопку для броска без анимации.';
  reroll.textContent='Бросить без анимации';reroll.disabled=false;
  reroll.onclick=()=>{simple();reroll.textContent='Перебросить обе кости';};
 }
 async function initialize(){
  try{
   const module=await loadRenderer();if(closed)return;
   const created=await module.createDiceRenderer(tray,{onStart:start,onResult:result,onError:fallback,onImpact:force=>sound?.impact(force)});
   if(closed){created.dispose();return;}
   renderer=created;reroll.onclick=()=>renderer?.roll();renderer.roll();
  }catch{fallback();}
 }
 // Closing must not wait for the lazy module or WASM initialization.
 if(animated)void initialize();
 else{reroll.onclick=simple;simple();}
 return finished;
}
