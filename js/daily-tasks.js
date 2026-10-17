    function dailyTaskValid(task) {
      return Boolean(task && typeof task.id === "string" && task.id && typeof task.name === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(task.localDateKey)
        && dateKey(dateFromKey(task.localDateKey)) === task.localDateKey
        && Number.isFinite(task.reward) && task.reward >= 0 && task.reward * 10 <= Number.MAX_SAFE_INTEGER
        && task.penalty === parseCoinAmount(task.reward * 10)
        && ["pending", "completed", "failed", "deleted"].includes(task.status));
    }

    function dailyTaskSettlementKey(task) {
      return settlementIdentity("daily-task", task.id, task.localDateKey);
    }

    function dailyTaskSettled(task, keys = null) {
      if (!dailyTaskValid(task) || task.status !== "pending" || task.settlementKey) return true;
      return (keys || buildSettledEventKeys()).has(dailyTaskSettlementKey(task));
    }

    function dailyTasksForToday() {
      return (state.dailyTasks || []).filter(task => dailyTaskValid(task)
        && task.localDateKey === dateKey() && task.status !== "deleted");
    }

    function pendingDailyTasks() { return dailyTasksForToday().filter(task => !dailyTaskSettled(task)); }

    function saveDailyTask({ id = null, name, reward }, { startFocus = false } = {}) {
      runAutomaticChecks({ showToast: false });
      name = String(name || "").trim();
      reward = Number(reward);
      if (!name || !Number.isFinite(reward) || reward < 0 || reward * 10 > Number.MAX_SAFE_INTEGER) {
        showToast("请输入任务名称和有效奖励"); return null;
      }
      const day = dateKey();
      const existing = id ? (state.dailyTasks || []).find(task => task.id === id) : null;
      if (id && (!existing || existing.localDateKey !== day || dailyTaskSettled(existing))) {
        showToast("任务已过期或已结算"); return null;
      }
      const before = JSON.stringify(state);
      const timestamp = new Date().toISOString();
      const task = { ...existing, id: existing?.id || createId("daily-task"), name,
        localDateKey: existing?.localDateKey || day, reward: parseCoinAmount(reward),
        penalty: parseCoinAmount(parseCoinAmount(reward) * 10), status: "pending",
        createdAt: existing?.createdAt || timestamp, updatedAt: timestamp };
      state.dailyTasks = existing ? state.dailyTasks.map(item => item.id === id ? task : item) : [...(state.dailyTasks || []), task];
      if (!saveTaskAction(before)) return null;
      closeSheet(); render();
      if (startFocus && typeof requestDailyTaskFocus === "function") requestDailyTaskFocus(task.id);
      return task.id;
    }

    function completeDailyTask(taskId, sourceEl = null, expectedDate = null) {
      if (runAutomaticChecks({ showToast: false })) render();
      const task = (state.dailyTasks || []).find(item => item.id === taskId);
      if (!task || task.localDateKey !== dateKey() || (expectedDate && expectedDate !== dateKey()) || dailyTaskSettled(task)) return false;
      const before = JSON.stringify(state);
      const previousProgress = progressSnapshot(task.localDateKey);
      const entry = settleDailyTask(task, "completed");
      if (!entry) return false;
      if (state.currentFocus?.sourceType === "dailyTask" && state.currentFocus.sourceId === taskId) state.currentFocus = null;
      if (!saveTaskAction(before)) return false;
      updatePrimaryReadouts();
      if (typeof renderFocusTask === "function") renderFocusTask();
      if (sourceEl && typeof animateHabitCompletion === "function") animateHabitCompletion(sourceEl);
      else render();
      showUndoToast({ type: "daily_task_completed", name: task.name, ...entry, previousProgress });
      return true;
    }

    function undoDailyTaskCompletion(undo) {
      const task = (state.dailyTasks || []).find(item => item.id === undo.taskId);
      const history = state.history.find(item => item.id === undo.historyId && item.taskKind === "dailyTask" && item.type === "task_completed");
      if (!task || task.status !== "completed" || task.settlementHistoryId !== undo.historyId || !history) { showToast("无法撤回"); return false; }
      const before = JSON.stringify(state);
      const amount = historyCoinDelta(history);
      removeCoinHistoryByIds([undo.historyId]);
      state.dailyTasks = state.dailyTasks.map(item => item.id === task.id ? { ...undo.previousTask } : item);
      undoCoinEvent({ coinDelta: amount, removeHistory: false });
      state.totals.completedTasks = Math.max(0, state.totals.completedTasks - 1);
      state.totals.earnedTaskCoins = Math.max(0, parseCoinAmount(state.totals.earnedTaskCoins - amount));
      restoreStreakSnapshot(undo.previousProgress);
      if (!saveTaskAction(before)) { showUndoToast(undo); return false; }
      render(); return true;
    }

    function deleteDailyTask(taskId) {
      if (runAutomaticChecks({ showToast: false })) render();
      const task = (state.dailyTasks || []).find(item => item.id === taskId);
      if (!task || task.localDateKey !== dateKey() || dailyTaskSettled(task)) return false;
      const before = JSON.stringify(state);
      task.status = "deleted"; task.deletedAt = new Date().toISOString(); task.updatedAt = task.deletedAt;
      if (state.currentFocus?.sourceType === "dailyTask" && state.currentFocus.sourceId === taskId) state.currentFocus = null;
      if (!saveTaskAction(before)) return false;
      closeSheet(); render(); return true;
    }

    function reorderDailyTask(taskId, targetId, after = false) {
      const tasks = pendingDailyTasks();
      if (taskId === targetId || !tasks.some(task => task.id === taskId) || !tasks.some(task => task.id === targetId)) return false;
      const before = JSON.stringify(state);
      const task = state.dailyTasks.find(item => item.id === taskId);
      const ordered = state.dailyTasks.filter(item => item.id !== taskId);
      ordered.splice(ordered.findIndex(item => item.id === targetId) + (after ? 1 : 0), 0, task);
      state.dailyTasks = ordered;
      if (!saveTaskAction(before)) return false;
      render(); return true;
    }

    function moveDailyTask(taskId, direction) {
      const tasks = pendingDailyTasks();
      const index = tasks.findIndex(task => task.id === taskId);
      const target = tasks[index + direction];
      if (target) reorderDailyTask(taskId, target.id, direction > 0);
    }
