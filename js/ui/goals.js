let goalFilter='active';
let goalSubmitting=false;
function goalDaysRemaining(deadline,today=dateKey()){
  const ordinal=day=>{const [y,m,d]=day.split('-').map(Number);return Date.UTC(y,m-1,d);};
  return Math.max(0,Math.round((ordinal(deadline)-ordinal(today))/86400000));
}
function goalNumber(value){return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:6}).format(value);}
function goalCardHtml(g){
  const active=g.status==='active',days=goalDaysRemaining(g.deadline);
  const status=active?(days?`剩余 ${days} 天`:g.deadline===dateKey()?'今天截止':'截止已过'):g.status==='achieved'?'已达成':'已到期';
  const progress=g.kind==='numeric'?Math.max(0,Math.min(1,goalProgress(g))):null;
  return `<article class="goal-card" data-goal-card="${escapeAttr(g.id)}">
    <div class="goal-card-heading"><h2><button type="button" class="goal-title" data-goal-detail="${escapeAttr(g.id)}" aria-label="查看${escapeAttr(g.name)}详情">${escapeHtml(g.name)}</button></h2>
      <span class="goal-deadline ${g.status==='achieved'?'is-achieved':''}">${active?actionIconHtml('clock'):''}${status}</span></div>
    ${progress!==null?`<div class="goal-progress-block"><div class="goal-value"><strong>${goalNumber(g.current)}</strong><span>/ ${goalNumber(g.target)} ${escapeHtml(g.unit||'')}</span></div>
      <progress class="goal-progress" value="${progress}" max="1" aria-label="${escapeAttr(g.name)}完成进度"></progress>
      <div class="goal-progress-caption"><span>起始 ${goalNumber(g.start)} ${escapeHtml(g.unit||'')}</span><span>已完成约 ${Math.round(progress*100)}%</span></div></div>`:''}
    <dl class="goal-agreement"><div><dt>达成奖励</dt><dd class="goal-reward">+${goalNumber(g.reward)} <span>金币</span></dd></div><div><dt>失败约定</dt><dd>${escapeHtml(g.penalty)}</dd></div></dl>
    <button type="button" class="goal-card-action" ${active?(g.kind==='numeric'?`data-goal-edit="${escapeAttr(g.id)}"`:`data-goal-settle="${escapeAttr(g.id)}"`):`data-goal-detail="${escapeAttr(g.id)}"`}>${active?(g.kind==='numeric'?'更新进度':'标记完成'):'查看记录'}</button>
  </article>`;
}
function renderGoals() {
  const list=document.getElementById('goalList');if(!list)return;
  const goals=(state.longTermGoals||[]).filter(g=>goalFilter==='active'?g.status==='active':g.status!=='active').slice().sort((a,b)=>a.deadline.localeCompare(b.deadline));
  list.innerHTML=goals.length?goals.map(goalCardHtml).join(''):'<p class="empty-state">暂无目标</p>';
  document.querySelectorAll('[data-goal-filter]').forEach(b=>b.classList.toggle('active',b.dataset.goalFilter===goalFilter));
  const summary=document.getElementById('fundSummary');
  if(summary)summary.innerHTML=`当前金币 ${state.coins} · 基金 ${state.rewards.length} 项 · 已达成 ${state.achievements.length}<div>${state.rewards.slice(0,2).map(r=>`${escapeHtml(r.name)} · ${Math.round(100*(r.currentCoins||0)/(r.totalCoins||1))}%`).join('　')}</div>`;
}
function goalSheet(title,body,mode='goal-detail') {
  sheetMode=mode;els.sheetTitle.textContent=title;els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:body,submitLabel:mode==='goal-edit'?'保存目标':mode==='goal-action'?'加入今日重点':'关闭'});
  openSheet({position:'bottom',kind:mode,keyboardForm:true});
}
function editGoal(id=null) {
  const g=(state.longTermGoals||[]).find(g=>g.id===id);if(g && g.status!=='active')return;
  const field=(key,label,type='text',value=g?.[key]??'')=>`<label class="field"><span>${label}</span>${key==='penalty'
    ?`<textarea name="penalty" rows="2" required>${escapeHtml(String(value))}</textarea>`
    :`<input name="${key}" type="${type}" value="${escapeAttr(String(value))}" ${['name','deadline','reward'].includes(key)?'required':''} ${type==='number'?'step="any" inputmode="decimal"':''} ${key==='reward'?'min="0"':''}>`}</label>`;
  goalSheet(g?'编辑目标':'新建目标',`${field('name','目标名称')}${field('deadline','截止日期','date')}
    <div class="goal-agreement-fields">${field('reward','达成奖励（金币）','number',g?.reward??500)}${field('penalty','失败约定')}</div>
    ${g?.kind==='milestones'?'':`<button class="goal-numeric-toggle" type="button" data-toggle-goal-numeric aria-expanded="${g?.kind==='numeric'}"></button>
      <div class="goal-numeric-fields" data-goal-numeric ${g?.kind==='numeric'?'':'hidden'}>${field('start','起始值','number')}${field('target','目标值','number')}${field('current','当前值','number')}${field('unit','单位')}</div>`}`,'goal-edit');
  els.sheetForm.dataset.goalId=id||'';syncGoalNumeric();
}
function syncGoalNumeric(){
  const section=els.sheetForm.querySelector('[data-goal-numeric]');if(!section)return;
  const enabled=!section.hidden,button=els.sheetForm.querySelector('[data-toggle-goal-numeric]');
  section.querySelectorAll('input').forEach(input=>input.disabled=!enabled);
  button.textContent=enabled?'移除数值进度':'添加数值进度';button.setAttribute('aria-expanded',String(enabled));
}
function goalEditorPayload(values,previous,numericEnabled){
  const data={name:values.name,deadline:values.deadline,reward:parseCoinAmount(Number(values.reward)),penalty:values.penalty};
  // Omitted legacy fields are preserved by saveGoal's merge, including milestone identity/logs.
  if(previous?.kind==='milestones')return data;
  const keys=['start','target','current'],hasNumbers=keys.some(key=>String(values[key]??'').trim());
  if(numericEnabled&&hasNumbers){
    if(keys.some(key=>!String(values[key]??'').trim()||!Number.isFinite(Number(values[key]))))throw Error('请填写完整的起始值、目标值和当前值');
    Object.assign(data,{kind:'numeric',unit:String(values.unit||'')});keys.forEach(key=>data[key]=Number(values[key]));
  }else data.kind='completion';
  if(!previous)data.milestones=[];
  return data;
}
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
document.addEventListener('submit',async e=>{
  if(e.target!==els.sheetForm)return;
  if(sheetMode==='goal-detail'){e.preventDefault();closeSheet();return;}
  if(sheetMode!=='goal-edit')return;e.preventDefault();if(goalSubmitting)return;goalSubmitting=true;
  try{
    const id=els.sheetForm.dataset.goalId||null,previous=(state.longTermGoals||[]).find(g=>g.id===id);
    const section=els.sheetForm.querySelector('[data-goal-numeric]');
    const data=goalEditorPayload(Object.fromEntries(new FormData(els.sheetForm)),previous,Boolean(section&&!section.hidden));
    await saveGoal(data,id);closeSheet();renderGoals();
  }catch(error){showToast(error.message);}finally{goalSubmitting=false;}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try {
    if(b.hasAttribute('data-open-goal'))editGoal();
    if(b.dataset.goalFilter){goalFilter=b.dataset.goalFilter;renderGoals();}
    if(b.dataset.goalDetail){await refreshGoals();goalDetail(b.dataset.goalDetail);}
    if(b.dataset.goalEdit)editGoal(b.dataset.goalEdit);
    if(b.hasAttribute('data-toggle-goal-numeric')){const section=els.sheetForm.querySelector('[data-goal-numeric]');section.hidden=!section.hidden;syncGoalNumeric();}
    if(b.dataset.goalSettle && await askForConfirmation({title:'确认目标达成？',message:'确认后领取目标奖励，可在五分钟内纠错。',confirmText:'确认达成'})){await settleGoal(b.dataset.goalSettle);if(!b.closest('.goal-card'))goalDetail(b.dataset.goalSettle);render();}
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
window.addEventListener('storage',()=>{
  // The central owner must decide whether a cross-window snapshot is safe to read.
  if(typeof LifeOSPersistence!=='undefined')return;
  state=loadState();if(!storageReadBlocked){render();renderGoals();}
});
setTimeout(refreshGoals,0);
let goalMidnightTimer;
function scheduleGoalMidnight(){clearTimeout(goalMidnightTimer);const next=new Date();next.setHours(24,0,0,0);goalMidnightTimer=setTimeout(async()=>{await refreshGoals();scheduleGoalMidnight();},Math.max(1,next-Date.now()));}
scheduleGoalMidnight();
