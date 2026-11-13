const reviewDraftQueue=new Map();
let reviewDraftTimer;
function priorityFieldsHtml(review) {
 return `<div class="review-plan-list">${reviewPlanRows(review).map(row=>planRowHtml(row)).join("")}</div><button type="button" class="review-plan-add" data-add-review-plan>＋ 添加重点</button>`;
}
function planRowHtml(row) {
 return `<div class="review-plan-row" data-plan-row="${escapeAttr(row.id)}"><input type="text" data-review-priority data-original="${escapeAttr(JSON.stringify(row.text))}" value="${escapeAttr(row.text.replace(/[\r\n]/g," "))}" aria-label="明日重点"><button type="button" data-plan-move="-1" aria-label="上移">↑</button><button type="button" data-plan-move="1" aria-label="下移">↓</button><button type="button" data-plan-remove aria-label="移除重点">×</button></div>`;
}
function collectPlanEntries(form) {
 return [...form.querySelectorAll("[data-plan-row]")].map(row=>{
  const input=row.querySelector("[data-review-priority]"),original=JSON.parse(input.dataset.original);
  return {id:row.dataset.planRow,text:input.value===original.replace(/[\r\n]/g," ")?original:input.value};
 });
}
function collectPriorityFields(form) {return collectPlanEntries(form).map(row=>row.text);}
function refreshScoreNumbers(input) {
 input.closest(".review-score-field").querySelector("output").textContent=input.dataset.hasValue==="true"?`${input.value} / 10`:"未评分";
}
function readReviewDraft(day) {
 const d=reviewDraftQueue.get(day)||state.reviewDrafts?.[day];
 return d && d.version===1 && (d.dailyScore===null||normalizeDailyScore(d.dailyScore)===d.dailyScore) ? d : null;
}
function flushReviewDrafts() {
 clearTimeout(reviewDraftTimer);
 if(!reviewDraftQueue.size)return;
 const before=state.reviewDrafts;
 state.reviewDrafts={...(before||{}),...Object.fromEntries(reviewDraftQueue)};
 try{saveState();reviewDraftQueue.clear();}
 catch(error){state.reviewDrafts=before;reportAppFailure("复盘草稿未能保存，请保留当前页面后重试。");}
}
function clearReviewDraft(day) {reviewDraftQueue.delete(day);if(state.reviewDrafts)delete state.reviewDrafts[day];}
function hydrateReviewEditor(day,review,main=false) {
 const form=main?els.dailyReviewForm:els.sheetForm,draft=readReviewDraft(day);
 form.dataset.reviewDraftDate=day;
 if(main){
  document.getElementById("reviewPriorityFields").innerHTML=priorityFieldsHtml(draft||review);
  els.reviewPriority=form.querySelector("[data-review-priority]");
 }
 let autoEl=main?document.getElementById("reviewAutoGood"):form.querySelector("[data-auto-good]");
 if(!autoEl){autoEl=document.createElement("div");autoEl.dataset.autoGood="";form.querySelector("[data-legacy-best]").append(autoEl);}
 const records=unifiedCompletedRecords(day);
 autoEl.innerHTML=records.length?records.map(r=>`<div class="review-auto-good" data-completion-ref="${escapeAttr(r.id)}">${escapeHtml(r.title)}</div>`).join(""):'<p class="field-help">当天暂无完成记录</p>';
 if(draft){const input=form.querySelector("[data-daily-score]");input.value=String(draft.dailyScore??5);input.dataset.hasValue=String(draft.dailyScore!==null);}
 refreshScoreNumbers(form.querySelector("[data-daily-score]"));
}
function queueReviewDraft(form) {
 const day=form.dataset.reviewDraftDate,prior=readReviewDraft(day),review=state.dailyReviews[day];
 const score=form.querySelector("[data-daily-score]");
 reviewDraftQueue.set(day,{version:1,bestItems:prior?.bestItems||reviewBestItems(review),mistake:prior?.mistake??review?.mistake??"",
  priority:collectPriorityFields(form).filter(Boolean).join("\n"),priorityEntries:collectPlanEntries(form),
  dailyScore:score.dataset.hasValue==="true"?Number(score.value):null});
 clearTimeout(reviewDraftTimer);reviewDraftTimer=setTimeout(flushReviewDrafts,600);
}
document.addEventListener("input",event=>{
 const form=event.target.closest("[data-review-draft-date]");
 if(!form||!event.target.matches("input,textarea"))return;
 if(event.target.matches("[data-daily-score]"))event.target.dataset.hasValue="true";
 queueReviewDraft(form);
});
document.addEventListener("click",event=>{
 if(event.target.closest("[data-nav]"))flushReviewDrafts();
 const form=event.target.closest("[data-review-draft-date]");
 if(!form)return;
 const row=event.target.closest("[data-plan-row]");
 if(event.target.closest("[data-add-review-plan]")){
  form.querySelector(".review-plan-list").insertAdjacentHTML("beforeend",planRowHtml({id:createId("review-plan"),text:""}));
  form.querySelector(".review-plan-list").lastElementChild.querySelector("input").focus();
 }else if(event.target.closest("[data-plan-remove]"))row.remove();
 else if(event.target.closest("[data-plan-move]")){
  const direction=Number(event.target.closest("[data-plan-move]").dataset.planMove);
  const target=direction<0?row.previousElementSibling:row.nextElementSibling;
  if(target)direction<0?target.before(row):target.after(row);
 }else return;
 queueReviewDraft(form);
},true);
document.addEventListener("focusout",flushReviewDrafts);
window.addEventListener("pagehide",flushReviewDrafts);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushReviewDrafts();});
