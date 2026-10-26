import '../src/board-styles.js';
import '../src/dice.css';
import {makeTheme,quintessences} from '../src/theme-model.js';
import {renderTheme,editorTools} from '../src/editor-ui.js';
import {openCharacterPicker} from '../src/character-picker.js';
import {openDiceTray} from '../src/dice.js';
await Promise.all([document.fonts.load('400 16px "Bad Script"'),document.fonts.load('500 12px "Alegreya SC"')]);
const root=document.querySelector('main'),tools=editorTools(root),{el,btn,dialog}=tools;
const heading=el('h2','','Проверка шрифтов и букв A–J'),nav=el('nav'),gallery=el('section','mt-v4');gallery.style.cssText='display:flex;gap:12px;align-items:flex-start;zoom:1.25';root.append(heading,nav,gallery);
for(const [index,letters]of ['ABCDEFG','HIJABCD'].entries()){
 const t=makeTheme('circumstance','proof-'+index);t.power.forEach((q,i)=>{q.q=letters[i];q.text=i?'Проверка буквы '+letters[i]:'Все буквы по центру';});t.weakness.forEach((q,i)=>q.text='Русский рукописный текст');const card=renderTheme(t,{isSelected:()=>false,select:()=>{},change:async()=>{},report:console.error,replace:async()=>{},expanded:true},tools);gallery.append(card);
}
nav.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:12px';
nav.append(btn('Вопросы','',()=>gallery.querySelector('.mt-question').click()),btn('Особое улучшение','',()=>gallery.querySelector('.mt-improvement-title').click()),btn('Квинтэссенция','',()=>dialog(quintessences[2].name,form=>form.append(el('p','',quintessences[2].text),el('small','mt-source-note','Герой · стр. 194')))),btn('Темник','',()=>gallery.querySelector('.mt-book-picker').click()),btn('Персонажи','',()=>openCharacterPicker(root,{listCharacters:()=>[{id:'proof',state:{name:'Эрин из Вересковой долины'}}],activeId:()=> 'proof',createCharacter:()=>{},selectCharacter:()=>{},deleteCharacter:()=>{}},()=>{})),btn('Подтверждение','',()=>dialog('Удалить заметку?',(form,close)=>form.append(el('p','','Удалить заметку «Сказания Туманной долины»?'),btn('Отмена','',close),btn('Удалить','',close)))),btn('Теги и статусы','',()=>dialog('Статусы с поля и из листа',(form,close)=>{const search=el('input');search.placeholder='Найти статус';const list=el('div','mt-action-source-options');list.append(btn('◇ Бодрость · 2','',()=>{}),btn('◇ Изранен · 3','',()=>{}));form.append(search,list,btn('Готово','',close));})),btn('Бросок','',()=>openDiceTray(root,{bonus:2,animated:false})),btn('Возврат карточек','',()=>{const d=dialog('Вернуть карточку в лист',(form,close)=>{const list=el('div','mt-board-return-list');list.append(btn('Вопросы и ответы','',()=>{}),btn('Русский текст','',()=>{}));form.append(list,btn('Закрыть','',close));});d.classList.add('mt-board-return-dialog');}));
