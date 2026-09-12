export const $=(s,root=document)=>root.querySelector(s);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;export function toast(message){const el=$('#toast');el.textContent=message;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.display='none',4200);}
export function showSheet(html){$('#sheet-body').innerHTML=html;const d=$('#sheet');if(!d.open)d.showModal();$('#sheet-close')?.addEventListener('click',()=>d.close());}
export const sheetHeader=title=>`<div class="row between"><h2>${esc(title)}</h2><button id="sheet-close" aria-label="关闭">✕</button></div>`;
export function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function busy(button,fn){if(button.disabled)return;button.disabled=true;const old=button.textContent;button.textContent='正在与星语连接…';try{return await fn();}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent=old;}}
export const hero=(eyebrow,title,desc,mark='✧')=>`<section class="hero"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div><div class="hero-mark" aria-hidden="true">${mark}</div></section>`;
