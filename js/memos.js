    let editingMemoId = null;

    function memoItems() {
      if (!Array.isArray(state.memos)) state.memos = [];
      return state.memos;
    }

    function memoTimeValue(memo) {
      const time = new Date(memo.updatedAt || memo.createdAt || 0).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    function sortedMemos() {
      return [...memoItems()].sort((left, right) => {
        if (Boolean(left.completed) !== Boolean(right.completed)) {
          return left.completed ? 1 : -1;
        }
        return memoTimeValue(right) - memoTimeValue(left);
      });
    }

    function unfinishedMemoCount() {
      return memoItems().filter(memo => !memo.completed).length;
    }

    function renderMemoSummary() {
      if (!els.homeMemoCount) return;
      els.homeMemoCount.textContent = formatNumber(unfinishedMemoCount());
    }

    function setMemoSubmitIcon(icon, label) {
      if (!els.saveMemoBtn) return;
      els.saveMemoBtn.setAttribute("aria-label", label);
      els.saveMemoBtn.innerHTML = actionIconHtml(icon);
    }

    function clearMemoForm() {
      editingMemoId = null;
      if (els.memoInput) els.memoInput.value = "";
      setMemoSubmitIcon("plus", "新增备忘录");
    }

    function renderMemos() {
      if (!els.memoList) return;
      const memos = sortedMemos();
      if (!memos.length) {
        els.memoList.innerHTML = `
          <div class="empty-state memo-empty">
            <strong>还没有备忘录</strong>
            <p>把临时想到的事情先放这里。</p>
          </div>
        `;
        return;
      }

      els.memoList.innerHTML = memos.map(memo => {
        const memoId = escapeAttr(memo.id);
        const completed = Boolean(memo.completed);
        return `
          <article class="memo-item ${completed ? "completed" : ""}" data-memo-item="${memoId}">
            ${iconActionButtonHtml({
              className: `memo-action ${completed ? "completed" : ""}`,
              icon: "checkmark.circle",
              label: completed ? "标记未完成" : "标记完成",
              attrs: `data-toggle-memo="${memoId}"`
            })}
            <div class="memo-body" role="button" tabindex="0" data-edit-memo="${memoId}" aria-label="编辑备忘录">
              <p class="memo-text">${escapeHtml(memo.text)}</p>
            </div>
            ${iconActionButtonHtml({
              className: "memo-action memo-delete",
              icon: "trash",
              label: "删除备忘录",
              attrs: `data-delete-memo="${memoId}"`
            })}
          </article>
        `;
      }).join("");
    }

    function openMemoSheet() {
      clearMemoForm();
      renderMemoSummary();
      renderMemos();
      syncSheetViewport();
      els.memoBackdrop.classList.remove("hidden");
      els.memoBackdrop.setAttribute("aria-hidden", "false");
      syncModalState();
      window.setTimeout(() => {
        try {
          els.memoInput?.focus({ preventScroll: true });
        } catch {
          els.memoInput?.focus();
        }
        els.memoInput?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 150);
    }

    function closeMemoSheet() {
      clearMemoForm();
      els.memoBackdrop.classList.add("hidden");
      els.memoBackdrop.setAttribute("aria-hidden", "true");
      syncModalState();
    }

    function saveMemoText(text) {
      const value = String(text || "").trim();
      if (!value) {
        showToast("请输入备忘录");
        return;
      }

      const now = new Date().toISOString();
      if (editingMemoId) {
        state.memos = memoItems().map(memo => (
          memo.id === editingMemoId
            ? { ...memo, text: value, updatedAt: now }
            : memo
        ));
        showToast("备忘录已更新");
      } else {
        state.memos.unshift({
          id: createId("memo"),
          text: value,
          completed: false,
          createdAt: now,
          updatedAt: now
        });
        showToast("备忘录已添加");
      }

      saveState();
      clearMemoForm();
      renderMemoSummary();
      renderMemos();
    }

    function editMemo(memoId) {
      const memo = memoItems().find(item => item.id === memoId);
      if (!memo || !els.memoInput) return;
      editingMemoId = memo.id;
      els.memoInput.value = memo.text || "";
      setMemoSubmitIcon("checkmark.circle", "保存备忘录");
      try {
        els.memoInput.focus({ preventScroll: true });
      } catch {
        els.memoInput.focus();
      }
      els.memoInput.scrollIntoView({ block: "nearest", behavior: "smooth" });
      els.memoInput.setSelectionRange(els.memoInput.value.length, els.memoInput.value.length);
    }

    function toggleMemo(memoId) {
      const now = new Date().toISOString();
      state.memos = memoItems().map(memo => (
        memo.id === memoId
          ? {
              ...memo,
              completed: !memo.completed,
              completedAt: memo.completed ? null : now,
              updatedAt: now
            }
          : memo
      ));
      saveState();
      renderMemoSummary();
      renderMemos();
    }

    function deleteMemo(memoId) {
      state.memos = memoItems().filter(memo => memo.id !== memoId);
      if (editingMemoId === memoId) clearMemoForm();
      saveState();
      renderMemoSummary();
      renderMemos();
      showToast("备忘录已删除");
    }

    function handleMemoSubmit(event) {
      event.preventDefault();
      saveMemoText(new FormData(els.memoForm).get("memo"));
    }
