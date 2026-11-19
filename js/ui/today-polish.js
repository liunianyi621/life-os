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

// In the compact layout, holding the name edits; only the handle reorders.
let compactHabitPress=null,compactHabitHeld=null;
function cancelCompactHabitPress(){clearTimeout(compactHabitPress?.timer);compactHabitPress=null;}
document.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  const button=event.target.closest('.today-execution-columns.is-dual [data-habit-actions]');
  if(!button)return;
  cancelCompactHabitPress();compactHabitHeld=null;
  const press={button,x:event.clientX,y:event.clientY};compactHabitPress=press;
  press.timer=setTimeout(()=>{if(compactHabitPress!==press)return;compactHabitHeld=button;cancelCompactHabitPress();openHabitSheet(button.dataset.habitActions);},500);
});
document.addEventListener('pointermove',event=>{const p=compactHabitPress;if(p&&Math.hypot(event.clientX-p.x,event.clientY-p.y)>8)cancelCompactHabitPress();},{passive:true});
document.addEventListener('pointerup',()=>{cancelCompactHabitPress();setTimeout(()=>{compactHabitHeld=null;},500);});
document.addEventListener('pointercancel',cancelCompactHabitPress);
window.addEventListener('scroll',cancelCompactHabitPress,{passive:true});
document.addEventListener('click',event=>{if(compactHabitHeld&&event.target.closest('[data-habit-actions]')===compactHabitHeld){compactHabitHeld=null;event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('contextmenu',event=>{if(event.target.closest('.today-execution-columns.is-dual [data-habit-actions]'))event.preventDefault();});
