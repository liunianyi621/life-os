let markerLastSubmit = -Infinity;
let markerUndo = null;
let markerUndoTimer;
let markerSelectedDay = null;

function procrastinationEvents(day) {
  return (Array.isArray(state.procrastinationMarkers) ? state.procrastinationMarkers : [])
    .filter(e => e && e.type === "procrastination_marker" && !e.revokedAt && (!day || e.localDateKey === day));
}

function recordProcrastination(now = new Date()) {
  const elapsed = Date.now() - markerLastSubmit;
  if (elapsed >= 0 && elapsed < 250) return null;
  const previous = state.procrastinationMarkers;
  if (previous !== undefined && !Array.isArray(previous)) return null;
  const event = { id: createId("marker"), type: "procrastination_marker", createdAt: now.toISOString(),
    localDateKey: dateKey(now), localTime: `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}` };
  state.procrastinationMarkers = [...(previous || []), event];
  try { saveState(); }
  catch { state.procrastinationMarkers = previous; return null; }
  markerLastSubmit = Date.now();
  return event;
}

function revokeProcrastination(id) {
  const event = procrastinationEvents().find(e => e.id === id);
  if (!event) return false;
  event.revokedAt = new Date().toISOString();
  try { saveState(); }
  catch { delete event.revokedAt; return false; }
  return true;
}

function procrastinationDays(now = new Date()) {
  const today = dateKey(now);
  return Array.from({length:28}, (_,i) => {
    const day = shiftDateKey(today,i-27);
    return {day,count:procrastinationEvents(day).length};
  });
}

function renderProcrastination() {
  const toolbar = document.getElementById("procrastinationToolbar");
  const today = dateKey(), days = procrastinationDays();
  if (toolbar) toolbar.innerHTML = `<span class="marker-label"><span aria-hidden="true">·</span> 拖延标记</span><span class="marker-actions"><span>今日 ${procrastinationEvents(today).length} 次</span><button type="button" data-record-marker>＋ 记一次</button>${markerUndo && Date.now()<markerUndo.until ? '<button type="button" data-undo-marker>撤回</button>' : ''}</span>`;
  const chart = document.getElementById("procrastinationChart");
  if (!chart) return;
  const week = days.slice(-7).reduce((sum,d)=>sum+d.count,0);
  chart.innerHTML = `<div class="marker-summary"><span>今日 ${procrastinationEvents(today).length} 次</span><span>最近 7 天 ${week} 次</span></div><div class="marker-grid">${days.map(d=>`<button type="button" data-marker-day="${d.day}" class="marker-cell marker-level-${d.count>=4?3:d.count>=2?2:d.count?1:0}" aria-label="${d.day}，${d.count} 次" aria-pressed="${markerSelectedDay===d.day}"><span>${Number(d.day.slice(-2))}</span></button>`).join('')}</div><p class="marker-caption">颜色越深，代表当天标记次数越多。</p><div id="markerDayDetail" aria-live="polite"></div>`;
  if (markerSelectedDay) {
    const events = procrastinationEvents(markerSelectedDay).slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    document.getElementById("markerDayDetail").innerHTML = `<strong>${markerSelectedDay} · ${events.length} 次</strong><div class="marker-times">${events.length ? events.map(e=>`<time datetime="${escapeAttr(e.createdAt)}">${escapeHtml(e.localTime || historyTimeLabel(e.createdAt))}</time>`).join('') : '当天没有记录'}</div>`;
  }
}

document.addEventListener("click",event=>{
  if (event.target.closest("[data-record-marker]")) {
    const record = recordProcrastination();
    if (!record) return;
    markerUndo = {id:record.id,until:Date.now()+4000};
    clearTimeout(markerUndoTimer);
    markerUndoTimer = setTimeout(()=>{markerUndo=null;renderProcrastination();},4000);
    renderProcrastination();
  } else if (event.target.closest("[data-undo-marker]") && markerUndo && Date.now()<markerUndo.until) {
    if (revokeProcrastination(markerUndo.id)) {markerUndo=null;clearTimeout(markerUndoTimer);renderProcrastination();}
  } else if (event.target.closest("[data-marker-day]")) {
    markerSelectedDay=event.target.closest("[data-marker-day]").dataset.markerDay;
    renderProcrastination();
  }
});
