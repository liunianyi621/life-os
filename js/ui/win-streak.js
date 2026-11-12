let winFundsOpen = false;
const WIN_LABELS = {win:"今日胜利",loss:"今日失败",rest:"休息日",absent:"未参赛",pending:"今天还没赢"};
function renderWinStreak() {
  if (syncWinStreak()) saveState();
  const enabled = winEnabled();
  const card = document.getElementById("winToday");
  const record = state.winStreak?.days[dateKey()];
  const summary = winSummary();
  card.hidden = !enabled;
  document.querySelector('[data-nav="rewards"] > span:last-child').textContent = enabled ? "战绩" : "奖励";
  document.querySelector("[data-win-toggle]").checked = enabled;
  if (enabled) {
    const chosen = record.choice && record.choice.type + ":" + record.choice.id;
    const complete = record.receipts.some(r=>r.key===chosen);
    const extra = Math.min(2,new Set(record.receipts.filter(r=>r.key!==chosen).map(r=>r.key)).size);
    card.innerHTML = `<div class="win-heading"><h2>今日战绩</h2><span>连胜 ${summary.current} 天</span></div>
      <strong class="${record.outcome==='win'?'win-positive':''}">${!record.choice && !record.rest ? "今天还没开始挑战" : WIN_LABELS[record.outcome]}</strong>
      <div class="win-heading"><span>${record.choice ? escapeHtml(record.choice.name) : record.rest ? "今天好好休息" : "选择一件最重要的事"}</span>
      <span>必胜 ${complete?1:0}/1 · 另外 ${extra}/2</span></div>
      ${!record.locked && !record.rest ? '<button type="button" class="win-text-action" data-win-choose>'+ (record.choice?"更换必胜任务":"选择必胜任务")+'</button>' : '<small>'+ (complete?"必胜任务已完成":record.rest?"":"必胜任务已锁定")+'</small>'}`;
    if(record.outcome==="win" && !record.notified) {
      record.notified=true; saveState();
      const notice=document.getElementById("winNotice");
      notice.textContent=`今日胜利 · 连续 ${summary.current} 天`; notice.hidden=false;
      window.setTimeout(()=>{notice.hidden=true;},3000);
    }
  }
  const rewards=document.querySelector('[data-view="rewards"]');
  const panel=document.getElementById("winRecords");
  panel.hidden=!enabled || winFundsOpen;
  for(const child of rewards.children) if(child!==panel && !child.hasAttribute("data-win-back")) child.hidden=enabled&&!winFundsOpen;
  document.querySelector("[data-win-back]").hidden=!enabled || !winFundsOpen;
  if(enabled) panel.innerHTML=`<header class="header q-page-header"><h1>战绩</h1><button class="win-text-action" data-win-funds>我的基金</button></header>
    <div class="win-metrics">${[["当前连胜",summary.current],["最长连胜",summary.longest],["累计胜场",summary.wins],["近30天胜率",summary.rate===null?"—":summary.rate+"%"]].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join("")}</div>
    <h2>近30天</h2><div class="win-calendar">${Array.from({length:30},(_,i)=>shiftDateKey(dateKey(),i-29)).map(day=>{
      const result=state.winStreak.days[day]?.outcome || "absent";
      return `<div class="win-day ${result}" title="${day} ${WIN_LABELS[result]}"><small>${day.slice(5)}</small><span>${{win:"胜",loss:"败",rest:"休",absent:"—",pending:"待"}[result]}</span></div>`;
    }).join("")}</div><p class="win-legend">胜：深色实心　败：空心　休：休息　—：未参赛</p>
    <button class="win-text-action" data-win-rest>将明天设为休息日</button>`;
}
function openWinPicker() {
  const candidates=winCandidates();
  els.sheetTitle.textContent="选择必胜任务";
  els.sheetForm.innerHTML=candidates.length ? candidates.map(c=>`<button type="button" class="settings-row" data-win-source="${c.type}" data-win-id="${escapeAttr(c.id)}"><span>${escapeHtml(c.name)}</span><small>${{habit:"每日习惯",dailyTask:"今日任务",priority:"今日重点"}[c.type]}</small></button>`).join("") : '<p>暂无可选择的未完成事项</p>';
  openSheet({position:"bottom"});
}
document.addEventListener("change",event=>{
  if(!event.target.matches("[data-win-toggle]")) return;
  if(!setWinEnabled(event.target.checked)) showToast("设置保存失败，请重试");
  winFundsOpen=false; render();
});
document.addEventListener("click",event=>{
  if(event.target.closest("[data-nav]")) winFundsOpen=false;
  if(event.target.closest("[data-win-choose]")) openWinPicker();
  const choice=event.target.closest("[data-win-source]");
  if(choice) { if(!chooseWinTask(choice.dataset.winSource,choice.dataset.winId)) showToast("该事项已开始、完成或失效"); closeSheet(); render(); }
  if(event.target.closest("[data-win-funds]")) {winFundsOpen=true;render();}
  if(event.target.closest("[data-win-back]")) {winFundsOpen=false;render();}
  if(event.target.closest("[data-win-rest]")) {
    if(planWinRest(shiftDateKey(dateKey(),1))) {showToast("明天已设为休息日");render();}
  }
});
