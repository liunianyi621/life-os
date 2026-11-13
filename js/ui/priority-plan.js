function renderPriorityGroup() {
 const group=state.priorityPlans?.[dateKey()],items=(group?.items||[]).filter(i=>i.title);
 els.priorityTaskCard.innerHTML=`<section class="priority-group"><div class="section-heading"><h2>今日重点</h2><span>${items.filter(i=>i.status==="done").length} / ${items.length}</span><button type="button" class="icon-button" data-open-priority aria-label="编辑今日重点">＋</button></div>
 ${items.map(item=>`<div class="priority-group-row"><div><strong>${escapeHtml(item.title)}</strong><small>+50 / −500${item.status==="failed"?" · 已结算":""}</small></div><button type="button" class="habit-complete-control" data-complete-priority-item="${escapeAttr(item.id)}" ${item.status!=="pending"?"disabled":""} aria-label="${item.status==="done"?"已完成":"完成"}：${escapeAttr(item.title)}">${item.status==="done"?"✓":"○"}</button></div>`).join("") || '<p class="empty-state">设定最多 3 件重点</p>'}</section>`;
}
function openPriorityGroupSheet(day) {
 sheetMode="priority-group";editingId=day;els.sheetTitle.textContent="今日重点";
 const group=state.priorityPlans?.[day];
 els.sheetForm.innerHTML=keyboardFormSheetHtml({bodyHtml:Array.from({length:3},(_,i)=>`<label class="review-good-row"><span>0${i+1}</span><input name="priority${i}" value="${escapeAttr(group?.items[i]?.title||"")}" ${group?.items[i]?.status && group.items[i].status!=="pending"?"readonly":""} aria-label="重点 ${i+1}"></label>`).join(""),submitLabel:"保存重点"});
 openSheet({position:"bottom",kind:"priority-group",keyboardForm:true});focusSheetField('[name="priority0"]');
}
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-complete-priority-item]");
 if(button) completePriorityItem(dateKey(),button.dataset.completePriorityItem);
});
document.addEventListener("submit",event=>{
 if(event.target!==els.sheetForm || sheetMode!=="priority-group") return;
 event.preventDefault();
 const before=JSON.stringify(state),titles=Array.from({length:3},(_,i)=>els.sheetForm.elements["priority"+i].value);
 syncPriorityPlan(editingId,titles,"manual");
 if(saveTaskAction(before)){closeSheet();render();}
});
