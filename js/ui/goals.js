let goalFilter='active';
let goalSubmitting=false;
function renderGoals() {
  const list=document.getElementById('goalList');if(!list)return;
  const goals=(state.longTermGoals||[]).filter(g=>goalFilter==='active'?g.status==='active':g.status!=='active').slice().sort((a,b)=>a.deadline.localeCompare(b.deadline));
  list.innerHTML=goals.length?goals.map(g=>`<button class="goal-card" data-goal-detail="${escapeAttr(g.id)}"><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.category||'')} · ${g.status==='active'?Math.max(0,Math.round((dateFromKey(g.deadline)-dateFromKey(dateKey()))/86400000))+' 天':g.status==='achieved'?'已达成':'未达成'} · ${g.deadline}</span>${g.kind!=='completion'?`<progress value="${goalProgress(g)}" max="1"></progress><span>${Math.round(goalProgress(g)*100)}%</span>`:''}<small>+${g.reward} · ${escapeHtml(g.penalty)}</small></button>`).join(''):'<p class="empty-state">暂无目标</p>';
  document.querySelectorAll('[data-goal-filter]').forEach(b=>b.classList.toggle('active',b.dataset.goalFilter===goalFilter));
  const summary=document.getElementById('fundSummary');
  if(summary)summary.innerHTML=`当前金币 ${state.coins} · 基金 ${state.rewards.length} 项 · 已达成 ${state.achievements.length}<div>${state.rewards.slice(0,2).map(r=>`${escapeHtml(r.name)} · ${Math.round(100*(r.currentCoins||0)/(r.totalCoins||1))}%`).join('　')}</div>`;
}
function goalSheet(title,body,mode='goal-detail') {
  sheetMode=mode;els.sheetTitle.textContent=title;els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:body,submitLabel:mode==='goal-edit'?'保存目标':mode==='goal-action'?'加入今日重点':'关闭'});
  openSheet({position:'bottom',kind:mode,keyboardForm:true});
}
function milestoneRow(m={id:createId('milestone'),name:'',done:false}) {
  return `<div class="goal-milestone" data-milestone="${escapeAttr(m.id)}"><input type="checkbox" ${m.done?'checked':''} aria-label="里程碑完成"><input type="text" value="${escapeAttr(m.name)}" placeholder="里程碑名称"><button type="button" data-goal-up aria-label="上移">↑</button><button type="button" data-goal-remove aria-label="移除">×</button></div>`;
}
function editGoal(id=null) {
  const g=(state.longTermGoals||[]).find(g=>g.id===id);if(g && g.status!=='active')return;
  const field=(key,label,type='text',value=g?.[key]??'')=>`<label class="field"><span>${label}</span><input name="${key}" type="${type}" value="${escapeAttr(String(value))}" ${['name','deadline','reward','penalty'].includes(key)?'required':''} ${type==='number'?'step="any"':''}></label>`;
  goalSheet(g?'编辑目标':'新建目标',`${field('name','目标名称')}${field('deadline','截止日期','date')}
    <div class="segmented">${['numeric','milestones','completion'].map((k,i)=>`<label><input type="radio" name="kind" value="${k}" ${(g?.kind||'completion')===k?'checked':''}>${['数值型','里程碑型','完成型'][i]}</label>`).join('')}</div>
    <div data-goal-numeric>${field('start','起始值','number',g?.start??0)}${field('target','目标值','number',g?.target??0)}${field('current','当前值','number',g?.current??0)}${field('unit','单位')}</div>
    <div data-goal-milestones><div id="goalMilestones">${(g?.milestones||[]).map(milestoneRow).join('')}</div><button type="button" class="review-plan-add" data-goal-add-milestone>＋ 里程碑</button></div>
    ${field('reward','达成奖励','number',g?.reward??500)}${field('penalty','未达成的承诺')}${field('category','分类（可选）')}${field('description','描述（可选）')}`,'goal-edit');
  els.sheetForm.dataset.goalId=id||'';syncGoalType();
}
function syncGoalType(){const kind=els.sheetForm.querySelector('[name=kind]:checked')?.value;
  els.sheetForm.querySelector('[data-goal-numeric]').hidden=kind!=='numeric';els.sheetForm.querySelector('[data-goal-milestones]').hidden=kind!=='milestones';}
function goalDetail(id) {
  const g=(state.longTermGoals||[]).find(g=>g.id===id);if(!g)return;
  goalSheet(g.name,`<p>${escapeHtml(g.description||'')}</p><p>截止 ${g.deadline} · 奖励 +${g.reward}</p>
    ${g.kind==='numeric'?`<p>${g.current} / ${g.target} ${escapeHtml(g.unit||'')} · ${Math.round(goalProgress(g)*100)}%</p>`:''}
    ${g.milestones.map(m=>`<p>${m.done || state.dailyTasks.some(t=>t.status==='completed'&&t.goalLink?.milestoneId===m.id)?'✓':'○'} ${escapeHtml(m.name)} ${g.status==='active'?`<button type="button" data-goal-action="${escapeAttr(id)}" data-milestone-id="${escapeAttr(m.id)}">加入今日重点</button>`:''}</p>`).join('')}
    <p>${g.status==='failed'?(g.fulfilledAt?'惩罚已履行':'待履行惩罚'):'未达成承诺'}：${escapeHtml(g.penalty)}</p>
    ${g.status==='active'?`<button type="button" class="q-secondary-button" data-goal-edit="${escapeAttr(id)}">编辑 / 更新进度</button><button type="button" class="q-secondary-button" data-goal-action="${escapeAttr(id)}">加入今日重点</button><button type="button" class="q-primary-button" data-goal-settle="${escapeAttr(id)}">确认达成并领取奖励</button>`:g.status==='failed'&&!g.fulfilledAt?`<button type="button" data-goal-fulfill="${escapeAttr(id)}">惩罚已履行</button>`:''}
    ${g.status!=='active'&&Date.now()-Date.parse(g.settledAt)<=300000?`<button type="button" class="review-plan-add" data-goal-correct="${escapeAttr(id)}">撤销本次结算</button>`:''}
    <h3>历史记录</h3>${g.log.map(l=>`<p class="field-help">${escapeHtml(l.at)} · ${escapeHtml(({created:'创建',edited:'编辑',achieved:'达成',failed:'到期未达成',reversed:'结算撤销',today_action:'加入今日重点',penalty_fulfilled:'惩罚已履行'})[l.action]||l.action)}</p>`).join('')}`);
}
async function refreshGoals(){if(typeof LifeOSPersistence!=='undefined'&&!LifeOSPersistence.writable)return;try{await goalTransaction(()=>{});renderGoals();}catch(e){showToast(e.message);}}
document.addEventListener('change',e=>{if(sheetMode==='goal-edit' && e.target.name==='kind')syncGoalType();});
document.addEventListener('submit',async e=>{
  if(e.target!==els.sheetForm)return;
  if(sheetMode==='goal-detail'){e.preventDefault();closeSheet();return;}
  if(sheetMode!=='goal-edit')return;e.preventDefault();if(goalSubmitting)return;goalSubmitting=true;
  const d=Object.fromEntries(new FormData(els.sheetForm));
  d.reward=parseCoinAmount(Number(d.reward));for(const k of ['start','target','current'])d[k]=Number(d[k]);
  d.milestones=[...els.sheetForm.querySelectorAll('[data-milestone]')].map(r=>({id:r.dataset.milestone,name:r.querySelector('[type=text]').value,done:r.querySelector('[type=checkbox]').checked}));
  try{await saveGoal(d,els.sheetForm.dataset.goalId||null);closeSheet();renderGoals();}catch(error){showToast(error.message);}finally{goalSubmitting=false;}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try {
    if(b.hasAttribute('data-open-goal'))editGoal();
    if(b.dataset.goalFilter){goalFilter=b.dataset.goalFilter;renderGoals();}
    if(b.dataset.goalDetail){await refreshGoals();goalDetail(b.dataset.goalDetail);}
    if(b.dataset.goalEdit)editGoal(b.dataset.goalEdit);
    if(b.hasAttribute('data-goal-add-milestone'))document.getElementById('goalMilestones').insertAdjacentHTML('beforeend',milestoneRow());
    if(b.hasAttribute('data-goal-remove'))b.closest('[data-milestone]').remove();
    if(b.hasAttribute('data-goal-up')){const r=b.closest('[data-milestone]');r.previousElementSibling?.before(r);}
    if(b.dataset.goalSettle && await askForConfirmation({title:'确认目标达成？',message:'确认后领取目标奖励，可在五分钟内纠错。',confirmText:'确认达成'})){await settleGoal(b.dataset.goalSettle);goalDetail(b.dataset.goalSettle);render();}
    if(b.dataset.goalCorrect){await correctGoal(b.dataset.goalCorrect);goalDetail(b.dataset.goalCorrect);render();}
    if(b.dataset.goalFulfill){await fulfillGoalPenalty(b.dataset.goalFulfill);goalDetail(b.dataset.goalFulfill);}
    if(b.dataset.goalAction){const id=b.dataset.goalAction,m=state.longTermGoals.find(g=>g.id===id)?.milestones.find(m=>m.id===b.dataset.milestoneId);
      if(m){await goalTodayAction(id,m.name,m.id);showToast('已加入今日重点');}
      else {goalSheet('加入今日重点',`<label class="field"><span>具体行动</span><input name="goalActionName" required></label>`,'goal-action');els.sheetForm.dataset.actionGoal=id;}}
    if(b.hasAttribute('data-open-funds')){switchView('rewards');render();}
    if(b.hasAttribute('data-funds-back')){switchView('stats');render();}
    if(b.dataset.nav==='goals')await refreshGoals();
  }catch(error){showToast(error.message);}
});
document.addEventListener('submit',async e=>{if(e.target!==els.sheetForm||sheetMode!=='goal-action')return;e.preventDefault();try{await goalTodayAction(els.sheetForm.dataset.actionGoal,new FormData(els.sheetForm).get('goalActionName'));closeSheet();render();}catch(error){showToast(error.message);}});
window.addEventListener('focus',refreshGoals);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshGoals();});
window.addEventListener('storage',()=>{state=loadState();render();renderGoals();});
setTimeout(refreshGoals,0);
let goalMidnightTimer;
function scheduleGoalMidnight(){clearTimeout(goalMidnightTimer);const next=new Date();next.setHours(24,0,0,0);goalMidnightTimer=setTimeout(async()=>{await refreshGoals();scheduleGoalMidnight();},Math.max(1,next-Date.now()));}
scheduleGoalMidnight();
