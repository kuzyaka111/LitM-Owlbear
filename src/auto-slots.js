// Keep the active input in place while appending the next empty row.
export function appendAutoSlot(host,{fields,items,limit,create,save,refresh,remove,commit,className}){
 if(items.length>=limit)return;
 const doc=host.ownerDocument,row=doc.createElement('div');row.className=className+' mt-auto-slot';let record=null;
 const inputs=fields.map(({key,label,max})=>{const input=doc.createElement('input');input.type='text';input.placeholder=label;input.setAttribute('aria-label',label);input.maxLength=max;input.dataset.field=key;row.append(input);return input;});
 inputs.forEach(input=>input.addEventListener('input',()=>{
  if(!record&&inputs.some(x=>x.value.trim())){
   record=create();items.push(record);row.classList.remove('mt-empty-slot');
   const del=doc.createElement('button');del.type='button';del.textContent='×';del.setAttribute('aria-label','Удалить строку');del.addEventListener('click',()=>remove(record));row.append(del);
   appendAutoSlot(host,{fields,items,limit,create,save,refresh,remove,commit,className});
  }
  if(record){for(const field of inputs)record[field.dataset.field]=field.value;refresh?.();save();}
 }));
 row.addEventListener('focusout',e=>{if(record&&inputs.some(x=>x.value.trim())&&!row.contains(e.relatedTarget)){commit?.(record,row);return;}if(record&&!row.contains(e.relatedTarget)&&!inputs.some(x=>x.value.trim())){const index=items.indexOf(record);if(index>=0)items.splice(index,1);record=null;row.remove();if(!host.querySelector('.mt-empty-slot'))appendAutoSlot(host,{fields,items,limit,create,save,refresh,remove,commit,className});refresh?.();save();}});
 row.classList.add('mt-empty-slot');host.append(row);
}
