import {dressScroll} from './scroll-view.js';
export function syncAnimationSettings(root,settings){
 const sheet=root.querySelector('.mt-v4');sheet.dataset.scrollAnimation=settings.scrollAnimation?'on':'off';
 for(const [kind,key] of [['sway','disableSway'],['entrance','disableEntrance'],['text','disableTextAnimation']])sheet.dataset[kind+'Animation']=settings.scrollAnimation&&!settings[key]?'on':'off';
}
export function mountAnimationSettings(root,state,save,fit,motion,tools){
 const {el,btn}=tools,host=root.querySelector('.mt-settings-cards');let detail=null;
 const options=[['disableSway','Отключить тряску'],['disableEntrance','Отключить появление'],['disableTextAnimation','Отключить анимацию текста']];
 function changed(){syncAnimationSettings(root,state.settings);motion.stop();save();sync();}
 function sync(){
  if(!detail)return;detail.querySelector('.mt-animation-enable-all').setAttribute('aria-pressed',String(state.settings.scrollAnimation&&!options.some(([key])=>state.settings[key])));
  detail.querySelector('.mt-animation-disable-all').setAttribute('aria-pressed',String(!state.settings.scrollAnimation));
  for(const [key] of options){const b=detail.querySelector('[data-animation-option="'+key+'"]');b.disabled=!state.settings.scrollAnimation;b.classList.toggle('mt-setting-disabled',b.disabled);b.setAttribute('aria-pressed',String(!!state.settings[key]));b.firstElementChild.textContent=state.settings[key]?'◆':'◇';}
 }
 function open(){
  if(detail){detail.querySelector('.mt-scroll-top').focus();return;}openButton.setAttribute('aria-expanded','true');
  detail=el('article','mt-theme mt-animation-settings');const head=el('div','mt-theme-head');head.tabIndex=0;head.append(el('span','','Настройки анимаций свитков'),btn('×','mt-note-close',()=>{detail.remove();detail=null;openButton.setAttribute('aria-expanded','false');fit();},'Закрыть настройки анимаций'));detail.append(head);
  const body=el('div','mt-settings-list'),all=el('div','mt-animation-all');
  all.append(btn('Включить все','mt-animation-enable-all',()=>{state.settings.scrollAnimation=true;options.forEach(([key])=>state.settings[key]=false);changed();}),btn('Отключить все','mt-animation-disable-all',()=>{state.settings.scrollAnimation=false;changed();}));body.append(all);
  for(const [key,label] of options){const b=btn('','mt-setting mt-animation-option',()=>{state.settings[key]=!state.settings[key];changed();});b.dataset.animationOption=key;b.append(el('span','mt-setting-diamond','◇'),el('span','mt-setting-label',label));body.append(b);}
  detail.append(body);host.append(dressScroll(detail));sync();fit();
 }
 const openButton=btn('Анимация свитков','mt-setting mt-open-animation-settings',open,'Анимация свитков');openButton.setAttribute('aria-expanded','false');root.querySelector('.mt-settings-list').append(openButton);
 const dice=btn('','mt-setting',()=>{state.settings.diceAnimation=!state.settings.diceAnimation;syncDice();save();});
 function syncDice(){dice.replaceChildren(el('span','mt-setting-diamond',state.settings.diceAnimation?'◆':'◇'),el('span','mt-setting-label','Анимация бросков'));dice.setAttribute('aria-pressed',String(state.settings.diceAnimation));}syncDice();root.querySelector('.mt-settings-list').append(dice);
 syncAnimationSettings(root,state.settings);return ()=>detail?2:1;
}
