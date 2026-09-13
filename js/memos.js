    let editingMemoId = null;
    const MEMO_STATUS = Object.freeze({ ACTIVE: "ACTIVE", COMPLETED: "COMPLETED", SCHEDULED: "SCHEDULED" });

    function memoItems() {
      if (!Array.isArray(state.memos)) state.memos = [];
      return state.memos;
    }

    function memoStatus(memo) {
      if (memo?.completed || String(memo?.status || "").toUpperCase() === MEMO_STATUS.COMPLETED) return MEMO_STATUS.COMPLETED;
      // Existing task-linked reminders keep their legacy ownership until the task resolves.
      if (memo?.linkedTaskId || String(memo?.status || "").toUpperCase() === MEMO_STATUS.SCHEDULED) return MEMO_STATUS.SCHEDULED;
      return MEMO_STATUS.ACTIVE;
    }

    function memoIsActive(memo) { return memoStatus(memo) === MEMO_STATUS.ACTIVE; }

    function memoSourceIdForTask(task) {
      if (String(task?.source || "").toUpperCase() !== "MEMO") return null;
      return task.sourceMemoId || task.originId || null;
    }

    function memoTimeValue(memo) {
      const time = new Date(memo.updatedAt || memo.createdAt || 0).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    function sortedMemos() {
      return [...memoItems()].sort((a, b) => memoTimeValue(b) - memoTimeValue(a));
    }

    function memoRowHtml(memo) {
      const id = escapeAttr(memo.id);
      return `<div class="memo-reminder-row" data-memo-item="${id}">
        <button class="memo-complete" type="button" data-toggle-memo="${id}" aria-label="完成提醒「${escapeAttr(memo.text)}」"><span class="memo-circle" aria-hidden="true"></span></button>
        <button class="memo-reminder-text" type="button" data-edit-memo="${id}">${escapeHtml(memo.text)}</button>
      </div>`;
    }

    function renderMemoSummary() {
      if (!els.homeMemoList) return;
      const active = sortedMemos().filter(memoIsActive);
      const previewLimit = active.length > 3 && typeof window !== "undefined" && window.innerHeight < 900 ? 2 : 3;
      els.homeMemoList.innerHTML = active.slice(0, previewLimit).map(memoRowHtml).join("")
        + (active.length > previewLimit ? `<button class="memo-more" type="button" data-open-memo>还有 ${active.length - previewLimit} 项 ›</button>` : "")
        || '<div class="memo-template-empty">暂无备忘录</div>';
    }

    function renderMemos() {
      if (!els.memoList) return;
      const active = sortedMemos().filter(memoIsActive);
      els.memoList.innerHTML = active.map(memoRowHtml).join("") || '<div class="memo-template-empty">暂无备忘录</div>';
    }

    function setMemoSubmitIcon(icon, label) {
      if (!els.saveMemoBtn) return;
      els.saveMemoBtn.setAttribute("aria-label", label);
      els.saveMemoBtn.textContent = label;
    }

    function clearMemoForm() {
      editingMemoId = null;
      if (els.memoInput) els.memoInput.value = "";
      els.memoForm?.classList.add("hidden");
      document.getElementById?.("memoEditDelete")?.classList.add("hidden");
      setMemoSubmitIcon("checkmark.circle", "保存");
    }

    function beginMemoInput(memoId = null) {
      clearMemoForm();
      const memo = memoId ? memoItems().find(item => item.id === memoId && memoIsActive(item)) : null;
      if (memoId && !memo) return;
      editingMemoId = memo?.id || null;
      els.memoForm.classList.remove("hidden");
      els.memoInput.value = memo?.text || "";
      document.getElementById?.("memoEditDelete")?.classList.toggle("hidden", !memo);
      els.memoInput.focus({ preventScroll: true });
      ensureFocusedFormFieldVisible(els.memoInput);
    }

    function openMemoSheet(memoId = null, add = false) {
      clearMemoForm();
      renderMemos();
      syncSheetViewport();
      els.memoBackdrop.classList.remove("hidden");
      els.memoBackdrop.setAttribute("aria-hidden", "false");
      syncModalState();
      if (memoId || add) beginMemoInput(memoId);
    }

    function closeMemoSheet() {
      if (els.memoBackdrop.contains(document.activeElement)) document.activeElement.blur();
      clearMemoForm();
      els.memoBackdrop.classList.add("hidden");
      els.memoBackdrop.setAttribute("aria-hidden", "true");
      syncModalState();
    }

    function persistMemoChange(before) {
      try { saveState(); return true; }
      catch (error) {
        state.memos = before;
        showToast("未能保存备忘录，请重试");
        return false;
      }
    }

    function saveMemoText(text) {
      const value = String(text || "").trim();
      if (!value) return false;
      const before = memoItems();
      const now = new Date().toISOString();
      if (editingMemoId) {
        state.memos = before.map(memo => memo.id === editingMemoId ? { ...memo, text: value, updatedAt: now } : memo);
      } else {
        state.memos = [{ id: createId("memo"), text: value, status: MEMO_STATUS.ACTIVE,
          completed: false, completedAt: null, createdAt: now, updatedAt: now }, ...before];
      }
      if (!persistMemoChange(before)) return false;
      clearMemoForm();
      renderMemoSummary();
      renderMemos();
      return true;
    }

    function editMemo(memoId) {
      if (els.memoBackdrop.classList.contains("hidden")) openMemoSheet(memoId);
      else beginMemoInput(memoId);
    }

    function toggleMemo(memoId) {
      const memo = memoItems().find(item => item.id === memoId);
      if (!memo || !memoIsActive(memo)) return;
      const before = memoItems();
      const now = new Date().toISOString();
      state.memos = before.map(item => item.id === memoId
        ? { ...item, status: MEMO_STATUS.COMPLETED, completed: true, completedAt: now } : item);
      if (!persistMemoChange(before)) return;
      if (editingMemoId === memoId) clearMemoForm();
      const rows = Array.from(document.querySelectorAll?.("[data-memo-item]") || [])
        .filter(row => row.dataset.memoItem === memoId);
      rows.forEach(row => {
        row.classList.add("is-completing");
        row.querySelector(".memo-complete").disabled = true;
        row.querySelector(".memo-circle").innerHTML = actionIconHtml("checkmark.circle");
      });
      const refresh = () => { renderMemoSummary(); renderMemos(); };
      if (rows.length) window.setTimeout(refresh, 180);
      else refresh();
      showUndoToast({ type: "memo_completed", memoSnapshot: { ...memo } }, { message: "已完成" });
    }

    function undoMemoCompletion(snapshot) {
      const before = memoItems();
      state.memos = before.map(item => item.id === snapshot.id ? { ...snapshot } : item);
      if (!persistMemoChange(before)) return false;
      renderMemoSummary();
      renderMemos();
      return true;
    }

    function deleteMemo(memoId) {
      const before = memoItems();
      state.memos = before.filter(item => item.id !== memoId);
      if (!persistMemoChange(before)) return;
      clearMemoForm();
      renderMemoSummary();
      renderMemos();
    }

    // Compatibility only: tasks created before independent reminders retain their source lifecycle.
    function releaseMemoForTask(task) {
      const memoId = memoSourceIdForTask(task);
      if (!memoId) return null;
      const memo = memoItems().find(item => item.id === memoId);
      if (!memo) return null;
      if (memo.linkedTaskId && memo.linkedTaskId !== task.id) return null;
      const previousMemo = { ...memo };
      state.memos = memoItems().map(item => (
        item.id === memoId
          ? {
              ...item,
              status: MEMO_STATUS.ACTIVE,
              linkedTaskId: null,
              updatedAt: new Date().toISOString()
            }
          : item
      ));
      return previousMemo;
    }

    function consumeMemoForCompletedTask(task) {
      const memoId = memoSourceIdForTask(task);
      if (!memoId) return null;
      const memo = memoItems().find(item => item.id === memoId);
      if (!memo) return null;
      if (memo.linkedTaskId && memo.linkedTaskId !== task.id) return null;
      state.memos = memoItems().filter(item => item.id !== memoId);
      return { ...memo };
    }

    function restoreMemoSnapshot(snapshot) {
      if (!snapshot?.id) return false;
      const existing = memoItems().some(item => item.id === snapshot.id);
      state.memos = existing
        ? memoItems().map(item => (item.id === snapshot.id ? { ...snapshot } : item))
        : [{ ...snapshot }, ...memoItems()];
      return true;
    }


    function handleMemoSubmit(event) {
      event.preventDefault();
      saveMemoText(new FormData(els.memoForm).get("memo"));
    }
