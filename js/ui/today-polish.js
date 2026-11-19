let todayPolishFrame=null;
function scheduleTodayPolish(){if(todayPolishFrame!==null)return;todayPolishFrame=requestAnimationFrame(()=>{todayPolishFrame=null;updateTodayPolish();});}
function updateTodayPolish(){
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
