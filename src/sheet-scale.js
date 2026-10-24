export const SHEET_SCALE=1.25;
export function renderedScale(root){
 const sheet=root.closest('.mt-v4')||root.querySelector('.mt-v4')||root;
 return Number.parseFloat(root.ownerDocument.defaultView.getComputedStyle(sheet).zoom)||1;
}
