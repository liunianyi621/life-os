const reviewDraftQueue = new Map();
let reviewDraftTimer;
function bestFieldsHtml(review, main = false) {
  return reviewBestItems(review).map((text,i) => `<label class="review-good-row"><span>${String(i+1).padStart(2,"0")}</span><input type="text" ${main&&i===0?'id="reviewBest"':''} name="best${i}" data-review-best data-original="${escapeAttr(JSON.stringify(text))}" aria-label="做得好的第${i+1}件事" placeholder="记下一件做得好的事" value="${escapeAttr(text.replace(/[\r\n]/g," "))}"></label>`).join("");
}
function collectBestFields(form) {
  return [...form.querySelectorAll("[data-review-best]")].map(input=>{
    const original=JSON.parse(input.dataset.original);
    return input.value===original.replace(/[\r\n]/g," ") ? original : input.value;
  });
}
function priorityFieldsHtml(review,main=false) {
 return reviewPriorityItems(review).map((text,i)=>`<label class="review-good-row"><span>0${i+1}</span><input type="text" ${main&&i===0?'id="reviewPriority"':''} name="priority${i}" data-review-priority data-original="${escapeAttr(JSON.stringify(text))}" value="${escapeAttr(text.replace(/[\r\n]/g," "))}" aria-label="明日重点 ${i+1}" placeholder="明天的一件重点"></label>`).join("");
}
function collectPriorityFields(form) {
 return [...form.querySelectorAll("[data-review-priority]")].map(input=>{
  const original=JSON.parse(input.dataset.original);
  return input.value===original.replace(/[\r\n]/g," ") ? original : input.value;
 });
}
function refreshScoreNumbers(input) {
 input.closest(".review-score-field").querySelector("output").textContent=input.dataset.hasValue==="true" ? `${input.value} / 10` : "未评分";
}
function readReviewDraft(day) {
  const draft=reviewDraftQueue.get(day)||state.reviewDrafts?.[day];
  return draft && draft.version===1 && (draft.dailyScore===null || normalizeDailyScore(draft.dailyScore)===draft.dailyScore)
    && Array.isArray(draft.bestItems) && draft.bestItems.length===3 && draft.bestItems.every(x=>typeof x==="string")
    && typeof draft.mistake==="string" && typeof draft.priority==="string" ? draft : null;
}
function flushReviewDrafts() {
  clearTimeout(reviewDraftTimer);
  if(!reviewDraftQueue.size) return;
  const before=state.reviewDrafts;
  state.reviewDrafts={...(before||{}),...Object.fromEntries(reviewDraftQueue)};
  try { saveState(); reviewDraftQueue.clear(); }
  catch(error) { state.reviewDrafts=before; reportAppFailure("复盘草稿未能保存，请保留当前页面后重试。"); }
}
function clearReviewDraft(day) {
  reviewDraftQueue.delete(day);
  if(state.reviewDrafts) delete state.reviewDrafts[day];
}
function hydrateReviewEditor(day, review, main=false) {
  const form=main?els.dailyReviewForm:els.sheetForm;
  const draft=readReviewDraft(day);
  form.dataset.reviewDraftDate=day;
  if(main) {
    document.getElementById("reviewBestFields").innerHTML=bestFieldsHtml(draft||review,true);
    els.reviewBest=document.getElementById("reviewBest");
    document.getElementById("reviewPriorityFields").innerHTML=priorityFieldsHtml(draft||review,true);
    els.reviewPriority=document.getElementById("reviewPriority");
  }
  const auto=priorityAutoGood(day);
  let autoEl=main?document.getElementById("reviewAutoGood"):form.querySelector("[data-auto-good]");
  if(!autoEl) {autoEl=document.createElement("div");autoEl.dataset.autoGood="";form.querySelector("[data-review-best]").closest(".field").append(autoEl);}
  autoEl.innerHTML=auto.map(item=>`<small class="review-auto-good" data-priority-ref="${escapeAttr(item.id)}">今日重点 · ${escapeHtml(item.title)}</small>`).join("");
  if(draft) {
    if(form.querySelector('[name="mistake"]')) form.querySelector('[name="mistake"]').value=draft.mistake;

    const input=form.querySelector("[data-daily-score]");
    input.value=String(draft.dailyScore??5);input.dataset.hasValue=String(draft.dailyScore!==null);
  }
  refreshScoreNumbers(form.querySelector("[data-daily-score]"));
}
document.addEventListener("input",event=>{
  const form=event.target.closest("[data-review-draft-date]");
  if(!form || !event.target.matches("input,textarea")) return;
  const score=form.querySelector("[data-daily-score]");
  if(event.target.matches("[data-daily-score]")) score.dataset.hasValue="true";
  reviewDraftQueue.set(form.dataset.reviewDraftDate,{version:1,bestItems:collectBestFields(form),
    mistake:form.querySelector('[name="mistake"]')?.value ?? readReviewDraft(form.dataset.reviewDraftDate)?.mistake ?? state.dailyReviews[form.dataset.reviewDraftDate]?.mistake ?? "",
    priority:collectPriorityFields(form).filter(Boolean).join("\n"),priorityItems:collectPriorityFields(form),
    dailyScore:score.dataset.hasValue==="true"?Number(score.value):null});
  clearTimeout(reviewDraftTimer);reviewDraftTimer=setTimeout(flushReviewDrafts,600);
});
document.addEventListener("click",event=>{
  if(event.target.closest("[data-nav]")) flushReviewDrafts();
},true);
document.addEventListener("focusout",flushReviewDrafts);
window.addEventListener("pagehide",flushReviewDrafts);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushReviewDrafts();});
