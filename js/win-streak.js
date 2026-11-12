// Independent audit projection. Never mutates coin events or source entities.
// Release rollback overrides saved enabled=true without modifying device data.
const WIN_STREAK_RELEASE_ENABLED = false;
function winExperimentValid(value) {
  const object = v => v && typeof v === "object" && !Array.isArray(v);
  return object(value) && value.version === 1 && typeof value.enabled === "boolean"
    && (value.ignored === undefined || (Array.isArray(value.ignored) && value.ignored.every(id => typeof id === "string")))
    && Array.isArray(value.windows) && value.windows.every(w => object(w) && Number.isFinite(Date.parse(w.start))
      && (w.end === null || Number.isFinite(Date.parse(w.end))))
    && object(value.days) && Object.entries(value.days).every(([day, r]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(day) && object(r) && Array.isArray(r.receipts)
      && r.receipts.every(x => object(x) && typeof x.key === "string" && typeof x.id === "string")
      && (r.choice == null || (object(r.choice) && ["habit","dailyTask","priority"].includes(r.choice.type)
        && typeof r.choice.id === "string" && typeof r.choice.name === "string")));
}
function winEnabled() { return WIN_STREAK_RELEASE_ENABLED && (state.winStreak == null || (winExperimentValid(state.winStreak) && state.winStreak.enabled)); }
function winEventKey(event) {
  if (event.type === "habit_completed" && event.habitId) return "habit:" + event.habitId;
  if (event.type === "task_completed" && event.taskKind === "dailyTask" && event.taskId) return "dailyTask:" + event.taskId;
  if (event.type === "priority_task_reward") return "priority:" + event.date;
  return null;
}
function winCandidates(day = dateKey()) {
  const priority = state.priorityTaskByDate?.[day];
  return [
    ...(priority?.status === "pending" ? [{ type:"priority", id:day, name:priority.title }] : []),
    ...(state.dailyTasks || []).filter(t => t.localDateKey === day && !dailyTaskSettled(t))
      .map(t => ({type:"dailyTask",id:t.id,name:t.name})),
    state.habits.filter(h => focusHabitAvailable(h.id, day)).map(h => ({type:"habit",id:h.id,name:h.name}))
  ].flat();
}
function syncWinStreak(now = new Date()) {
  if (!WIN_STREAK_RELEASE_ENABLED) return false;
  const before = JSON.stringify(state.winStreak);
  if (state.winStreak == null) state.winStreak = {
    version:1, enabled:true, windows:[{start:now.toISOString(),end:null}], days:{}
  };
  const model = state.winStreak;
  if (!winExperimentValid(model)) return false;
  for (const [day, record] of Object.entries(model.days)) {
    const choice = record.choice;
    if (!choice) continue;
    const completed = choice.type === "habit" ? habitCompletedOnDate(choice.id, day)
      : choice.type === "dailyTask" ? state.dailyTasks?.some(t => t.id === choice.id && t.localDateKey === day && t.status === "completed")
      : state.priorityTaskByDate?.[day]?.status === "done";
    const focused = state.currentFocus?.localDateKey === day && state.currentFocus.sourceType === choice.type && state.currentFocus.sourceId === choice.id;
    if (completed || focused) record.locked = true;
  }
  if (!model.enabled) {
    model.ignored ||= [];
    const retained = new Set(Object.values(model.days).flatMap(r => r.receipts.map(x => x.id)));
    for (const event of state.history) {
      if (winEventKey(event) && !retained.has(event.id) && !model.ignored.includes(event.id)) model.ignored.push(event.id);
    }
    return before !== JSON.stringify(model);
  }
  const today = dateKey(now);
  model.days[today] ||= { zone:Intl.DateTimeFormat().resolvedOptions().timeZone,
    openedAt:now.toISOString(), choice:null, locked:false, rest:false, receipts:[], notified:false };
  for (const [day, record] of Object.entries(model.days)) {
    // Only retain receipts still backed by an effective completion event (Undo removes it).
    record.receipts = record.receipts.filter(receipt => state.history.some(e => e.id === receipt.id && e.date === day && winEventKey(e) === receipt.key));
    for (const event of state.history) {
      const key = winEventKey(event), time = Date.parse(event.timestamp);
      if (!key || model.ignored?.includes(event.id) || event.date !== day || !model.windows.some(w => time >= Date.parse(w.start) && (w.end === null || time < Date.parse(w.end)))) continue;
      if (!record.receipts.some(r => r.key === key)) record.receipts.push({key,id:event.id});
    }
    if (record.choice && (record.receipts.some(r => r.key === record.choice.type + ":" + record.choice.id)
      || (state.currentFocus?.localDateKey === day && state.currentFocus.sourceType === record.choice.type
        && state.currentFocus.sourceId === record.choice.id))) record.locked = true;
    const previous = record.outcome;
    const chosen = record.choice && record.choice.type + ":" + record.choice.id;
    const priorityUnchanged = record.choice?.type !== "priority"
      || state.priorityTaskByDate?.[day]?.title === record.choice.name;
    const won = Boolean(chosen && priorityUnchanged && record.receipts.some(r => r.key === chosen)
      && new Set(record.receipts.filter(r => r.key !== chosen).map(r => r.key)).size >= 2);
    record.outcome = record.rest ? "rest" : !record.choice ? "absent" : won ? "win" : day < today ? "loss" : "pending";
    record.finalized = day < today;
    if (previous !== record.outcome) record.evaluatedAt = now.toISOString();
  }
  return before !== JSON.stringify(model);
}
function saveWinChange(change) {
  if (!WIN_STREAK_RELEASE_ENABLED) return false;
  const before = JSON.stringify(state);
  syncWinStreak();
  if (!winExperimentValid(state.winStreak)) return false;
  change(state.winStreak);
  return saveTaskAction(before);
}
function setWinEnabled(enabled) {
  return saveWinChange(model => {
    if (model.enabled === enabled) return;
    if (!enabled) model.windows.at(-1).end = new Date().toISOString();
    else model.windows.push({start:new Date().toISOString(),end:null});
    model.enabled = enabled;
  });
}
function chooseWinTask(type, id) {
  syncWinStreak();
  if (!winEnabled()) return false;
  const record = state.winStreak.days[dateKey()];
  const choice = winCandidates().find(c => c.type === type && c.id === id);
  if (!choice || record.rest || record.locked) return false;
  return saveWinChange(() => { record.choice = choice; });
}
function planWinRest(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day <= dateKey() || !winEnabled()) return false;
  return saveWinChange(model => {
    model.days[day] ||= {choice:null,locked:false,receipts:[],notified:false};
    model.days[day].rest = true;
  });
}
function winSummary() {
  const days = Object.entries(state.winStreak?.days || {}).filter(([day]) => day <= dateKey()).sort(([a],[b])=>a.localeCompare(b));
  let current=0, longest=0, wins=0;
  for (const [,r] of days) {
    if (r.outcome === "win") { current++; wins++; longest=Math.max(longest,current); }
    if (r.outcome === "loss") current=0;
  }
  const recent=days.filter(([day])=>day >= shiftDateKey(dateKey(),-29)).map(([,r])=>r).filter(r=>["win","loss"].includes(r.outcome));
  return {current,longest,wins,rate:recent.length ? Math.round(recent.filter(r=>r.outcome==="win").length/recent.length*100) : null};
}
