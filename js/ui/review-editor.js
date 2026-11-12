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
function scoreNumbersHtml(score) {
  return Array.from({length:10},(_,i)=>`<button type="button" data-review-score="${i+1}" aria-pressed="${score===i+1}">${i+1}</button>`).join("");
}
function refreshScoreNumbers(input) {
  const field=input.closest(".review-score-field");
  field.querySelectorAll("[data-review-score]").forEach(button=>button.setAttribute("aria-pressed",String(input.dataset.hasValue==="true" && Number(input.value)===Number(button.dataset.reviewScore))));
  field.querySelector("output").textContent=input.dataset.hasValue==="true" ? `已选 ${input.value} / 10` : "未评分";
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
    document.getElementById("reviewScoreNumbers").innerHTML=scoreNumbersHtml(null);
  }
  if(draft) {
    form.querySelector('[name="mistake"]').value=draft.mistake;
    form.querySelector('[name="priority"]').value=draft.priority;
    const input=form.querySelector("[data-daily-score]");
    input.value=String(draft.dailyScore??5);input.dataset.hasValue=String(draft.dailyScore!==null);
  }
  refreshScoreNumbers(form.querySelector("[data-daily-score]"));
}
document.addEventListener("input",event=>{
  const form=event.target.closest("[data-review-draft-date]");
  if(!form || !event.target.matches("input,textarea")) return;
  const score=form.querySelector("[data-daily-score]");
  reviewDraftQueue.set(form.dataset.reviewDraftDate,{version:1,bestItems:collectBestFields(form),
    mistake:form.querySelector('[name="mistake"]').value,priority:form.querySelector('[name="priority"]').value,
    dailyScore:score.dataset.hasValue==="true"?Number(score.value):null});
  clearTimeout(reviewDraftTimer);reviewDraftTimer=setTimeout(flushReviewDrafts,600);
});
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-review-score]");
  if(button) {
    const input=button.closest(".review-score-field").querySelector("[data-daily-score]");
    input.value=button.dataset.reviewScore; input.dataset.hasValue="true";
    input.dispatchEvent(new Event("input",{bubbles:true}));refreshScoreNumbers(input);
  }
  if(event.target.closest("[data-nav]")) flushReviewDrafts();
},true);
document.addEventListener("focusout",flushReviewDrafts);
window.addEventListener("pagehide",flushReviewDrafts);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushReviewDrafts();});
