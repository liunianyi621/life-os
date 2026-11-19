let todayPolishFrame=null;
function scheduleTodayPolish(){if(todayPolishFrame!==null)return;todayPolishFrame=requestAnimationFrame(()=>{todayPolishFrame=null;updateTodayPolish();});}
function updateTodayPolish(){
  const page=document.querySelector('.today-page'),toolbar=document.getElementById('procrastinationToolbar'),nav=document.querySelector('.bottom-nav');
  if(!page||!toolbar||!nav)return;
  const hide=!page.classList.contains('active')||page.dataset.dayMode==='vacation'||document.body.classList.contains('modal-open')||document.body.classList.contains('keyboard-open')||Boolean(document.activeElement?.matches('input,textarea,select'));
  if(toolbar.hidden!==hide)toolbar.hidden=hide;
  const navRect=nav.getBoundingClientRect();
  toolbar.style.bottom=Math.max(16,window.innerHeight-navRect.top+12)+'px';
  const rect=toolbar.getBoundingClientRect();
  // Reserve a right-hand pocket only in sections touching the floating control.
  for(const section of page.querySelectorAll(':scope > .today-section')){
    const r=section.getBoundingClientRect(),avoid=!hide&&r.top<rect.bottom+8&&r.bottom>rect.top-(toolbar.querySelector('[data-undo-marker]')?108:8);
    section.toggleAttribute('data-marker-avoid',avoid);
  }
  const amount=document.getElementById('homeCoins');
  if(amount){let size=22;amount.style.fontSize=size+'px';while(amount.scrollWidth>amount.clientWidth+1&&size>10)amount.style.fontSize=--size+'px';amount.title=amount.textContent;}
}
document.addEventListener('DOMContentLoaded',()=>{
  new MutationObserver(scheduleTodayPolish).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
  scheduleTodayPolish();
});
window.addEventListener('scroll',scheduleTodayPolish,{passive:true});window.addEventListener('resize',scheduleTodayPolish);
window.visualViewport?.addEventListener('resize',scheduleTodayPolish);window.visualViewport?.addEventListener('scroll',scheduleTodayPolish);
document.addEventListener('focusin',scheduleTodayPolish);document.addEventListener('focusout',scheduleTodayPolish);
