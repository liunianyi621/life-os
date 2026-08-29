    let editingMemoId = null;
    const MEMO_STATUS = Object.freeze({
      ACTIVE: "ACTIVE",
      SCHEDULED: "SCHEDULED"
    });

    function memoItems() {
      if (!Array.isArray(state.memos)) state.memos = [];
      return state.memos;
    }

    function memoTimeValue(memo) {
      const time = new Date(memo.updatedAt || memo.createdAt || 0).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    function memoStatus(memo) {
      if (memo?.completed) return "COMPLETED";
      if (memo?.linkedTaskId || String(memo?.status || "").toUpperCase() === MEMO_STATUS.SCHEDULED) {
        return MEMO_STATUS.SCHEDULED;
      }
      return MEMO_STATUS.ACTIVE;
    }

    function memoIsActive(memo) {
      return memoStatus(memo) === MEMO_STATUS.ACTIVE;
    }

    function memoSourceIdForTask(task) {
      if (String(task?.source || "").toUpperCase() !== "MEMO") return null;
      return task.sourceMemoId || task.originId || null;
    }

    function sortedMemos() {
      return [...memoItems()].sort((left, right) => {
        const statusOrder = { ACTIVE: 0, SCHEDULED: 1, COMPLETED: 2 };
        const orderDifference = statusOrder[memoStatus(left)] - statusOrder[memoStatus(right)];
        if (orderDifference) return orderDifference;
        return memoTimeValue(right) - memoTimeValue(left);
      });
    }

    function renderMemoSummary() {
      if (!els.homeMemoCount) return;
      const allMemos = sortedMemos();
      const activeMemos = allMemos.filter(memoIsActive);
      els.homeMemoCount.textContent = `${formatNumber(activeMemos.length)} 项`;

      if (!els.homeMemoList) return;
      if (!activeMemos.length) {
        els.homeMemoList.innerHTML = `
          <div class="memo-template-empty">${allMemos.length ? "今天没有待安排的备忘录" : "暂无备忘录"}</div>
        `;
        return;
      }

      els.homeMemoList.innerHTML = activeMemos.map(memo => `
        <button
          class="habit-template-chip memo-template-chip"
          type="button"
          data-memo-card="${escapeAttr(memo.id)}"
          data-home-memo-card="${escapeAttr(memo.id)}"
          aria-label="编辑备忘录「${escapeAttr(memo.text)}」，长按可安排到今日任务"
        >
          <span class="habit-template-chip__name">${escapeHtml(memo.text)}</span>
        </button>
      `).join("");
    }

    function setMemoSubmitIcon(icon, label) {
      if (!els.saveMemoBtn) return;
      els.saveMemoBtn.setAttribute("aria-label", label);
      els.saveMemoBtn.innerHTML = `${actionIconHtml(icon)}<span>${escapeHtml(label)}</span>`;
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
        const scheduled = memoStatus(memo) === MEMO_STATUS.SCHEDULED;
        if (scheduled) {
          return `
            <article class="memo-item memo-item-scheduled" data-memo-item="${memoId}">
              <div class="memo-body">
                <p class="memo-text">${escapeHtml(memo.text)}</p>
                <span class="memo-scheduled-label">已安排到今日任务</span>
              </div>
            </article>
          `;
        }
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

    function openMemoSheet(memoId = null) {
      clearMemoForm();
      renderMemoSummary();
      renderMemos();
      syncSheetViewport();
      els.memoBackdrop.classList.remove("hidden");
      els.memoBackdrop.setAttribute("aria-hidden", "false");
      syncModalState();
      if (memoId) {
        editMemo(memoId);
        return;
      }
      window.setTimeout(() => {
        try {
          els.memoInput?.focus({ preventScroll: true });
        } catch {
          els.memoInput?.focus();
        }
        ensureFocusedFormFieldVisible(els.memoInput);
      }, 150);
    }

    function closeMemoSheet() {
      if (els.memoBackdrop.contains(document.activeElement)) document.activeElement.blur();
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
          status: MEMO_STATUS.ACTIVE,
          linkedTaskId: null,
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
      ensureFocusedFormFieldVisible(els.memoInput);
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

    function linkMemoToTask(memoId, taskId, timestamp = new Date().toISOString()) {
      const memo = memoItems().find(item => item.id === memoId);
      if (!memo || !memoIsActive(memo)) return null;
      const previousMemo = { ...memo };
      state.memos = memoItems().map(item => (
        item.id === memoId
          ? { ...item, status: MEMO_STATUS.SCHEDULED, linkedTaskId: taskId, updatedAt: timestamp }
          : item
      ));
      return previousMemo;
    }

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

    function scheduleMemoAsTask(memoId, startTime = new Date(), scheduledSlotStart = null) {
      const memo = memoItems().find(item => item.id === memoId);
      const arrangedAt = new Date(startTime);
      const range = scheduledSlotStart
        ? getHourlyRangeFromStart(scheduledSlotStart)
        : getNextFullHourRange(arrangedAt);
      if (!memo || !memoIsActive(memo) || !range) return null;

      const scheduledAt = arrangedAt.toISOString();
      const scheduledStart = range.start.toISOString();
      const scheduledEnd = range.end.toISOString();
      const taskDateKey = dateKey(range.start);
      const timeStart = minutesToClockLabel(range.start.getHours() * 60 + range.start.getMinutes());
      const timeEnd = minutesToClockLabel(range.end.getHours() * 60 + range.end.getMinutes());
      const task = {
        ...createTaskRecord({
          name: memo.text,
          coins: DEFAULT_TASK_REWARD,
          hourlyReward: DEFAULT_TASK_REWARD,
          reward: DEFAULT_TASK_REWARD,
          source: "MEMO",
          originId: memo.id,
          sourceMemoId: memo.id,
          status: TASK_STATUS.WAITING,
          scheduledAt,
          scheduledStart,
          scheduledEnd,
          timeStart,
          timeEnd,
          time: timeStart,
          startedAt: null,
          actualStartTime: null,
          timerStartedAt: null,
          startTime: null,
          isRunning: false,
          elapsedSeconds: 0,
          endTime: null,
          estimateDurationMinutes: 60,
          durationMinutes: null,
          durationSeconds: null,
          earnedCoins: null,
          lifecycleEvents: [{
            id: createId("task-lifecycle"),
            type: TASK_LIFECYCLE_EVENT.SCHEDULED,
            timestamp: scheduledAt,
            source: "MEMO",
            originId: memo.id,
            scheduledStart,
            scheduledEnd
          }]
        }, arrangedAt),
        date: taskDateKey,
        createdDate: taskDateKey
      };

      state.tasks.push(task);
      const memoSnapshot = linkMemoToTask(memo.id, task.id, scheduledAt);
      if (!memoSnapshot) {
        state.tasks = state.tasks.filter(item => item.id !== task.id);
        return null;
      }
      try {
        saveState();
      } catch (error) {
        state.tasks = state.tasks.filter(item => item.id !== task.id);
        restoreMemoSnapshot(memoSnapshot);
        showToast("无法安排任务");
        return null;
      }
      render();
      showUndoToast({
        type: "memo_task_scheduled",
        taskId: task.id,
        memoId: memo.id,
        name: task.name,
        date: task.date
      }, {
        message: `已安排「${task.name}」`,
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "neutral"
      });
      return task;
    }

    function handleMemoSubmit(event) {
      event.preventDefault();
      saveMemoText(new FormData(els.memoForm).get("memo"));
    }
