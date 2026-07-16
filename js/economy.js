    const NO_BAD_HABIT_BONUS = 2;
    const PRIORITY_TASK_REWARD = 100;
    const PRIORITY_TASK_PENALTY = 1000;

    function priorityTaskSettlementAmount(status) {
      if (status === "done") return parseCoinAmount(PRIORITY_TASK_REWARD);
      if (status === "failed") return parseCoinAmount(PRIORITY_TASK_PENALTY);
      return 0;
    }

    function ensureNoBadHabitBonuses() {
      state.noBadHabitBonuses = state.noBadHabitBonuses && typeof state.noBadHabitBonuses === "object"
        ? state.noBadHabitBonuses
        : {};
      return state.noBadHabitBonuses;
    }

    function applyCoinBalanceDelta(amount) {
      state.coins = parseCoinAmount((Number(state.coins) || 0) + parseCoinAmount(amount));
      return state.coins;
    }

    function removeCoinHistoryByIds(historyIds = []) {
      const ids = historyIds instanceof Set ? historyIds : new Set(historyIds);
      if (!ids.size) return;
      state.history = state.history.filter(item => !ids.has(item.id));
    }

    function recordCoinEvent({
      type,
      amount = 0,
      date = dateKey(),
      timestamp = new Date().toISOString(),
      source = null,
      category = null,
      action = null,
      entityType = null,
      affectsBehaviorScore = true,
      history = {}
    }) {
      const historyId = history.id || createId("history");
      const coinDelta = parseCoinAmount(amount);
      const entry = {
        ...history,
        id: historyId,
        type,
        coinDelta,
        date: history.date || date,
        timestamp: history.timestamp || timestamp
      };
      const eventSource = source || entry.source;
      const eventAction = action || entry.action;
      const eventEntityType = entityType || entry.entityType;
      const isRewardEvent = isRewardPageEvent({
        ...entry,
        source: eventSource || entry.source,
        category: category || entry.category,
        action: eventAction || entry.action,
        entityType: eventEntityType || entry.entityType,
        affectsBehaviorScore: affectsBehaviorScore !== false && entry.affectsBehaviorScore !== false
      });
      if (isRewardEvent) {
        entry.source = "rewards";
        entry.category = category || entry.category || "reward_spending";
        entry.action = eventAction || type || "reward_action";
        entry.entityType = eventEntityType || "reward_fund";
        entry.affectsBehaviorScore = false;
      } else {
        if (isHabitPerformanceTransaction(entry)) {
          entry.source = eventSource || "behavior";
          entry.category = category || entry.category || "habit_performance";
          entry.action = eventAction || type;
          entry.entityType = eventEntityType || behaviorEntityTypeForEvent(type);
        } else {
          if (eventSource) entry.source = eventSource;
          if (category || entry.category) entry.category = category || entry.category;
          if (eventAction) entry.action = eventAction;
          if (eventEntityType) entry.entityType = eventEntityType;
        }
        entry.affectsBehaviorScore = affectsBehaviorScore !== false && entry.affectsBehaviorScore !== false;
      }
      applyCoinBalanceDelta(coinDelta);
      state.history.unshift(entry);
      return {
        historyId,
        entry,
        amount: coinDelta,
        date: entry.date,
        timestamp: entry.timestamp
      };
    }

    function recordRewardCoinEvent(options = {}) {
      const history = options.history || {};
      return recordCoinEvent({
        ...options,
        source: "rewards",
        category: "reward_spending",
        action: options.action || history.action || options.type || "reward_action",
        entityType: options.entityType || history.entityType || "reward_fund",
        affectsBehaviorScore: false,
        history
      });
    }

    function undoCoinEvent({ coinDelta = 0, historyIds = null, historyId = null, removeHistory = true }) {
      const ids = historyIds || (historyId ? [historyId] : []);
      if (removeHistory) removeCoinHistoryByIds(ids);
      return applyCoinBalanceDelta(-parseCoinAmount(coinDelta));
    }

    function summaryTotals() {
      if (!state.history.length) {
        return {
          completedTasks: state.totals.completedTasks || 0,
          coinsSpent: state.totals.coinsSpent || 0,
          coinsPenalty: state.totals.coinsPenalty || 0
        };
      }

      return state.history.reduce((totals, item) => {
        if (item.type === "task_completed" || item.type === "habit_completed") {
          totals.completedTasks += 1;
        }
        if (item.type === "task_completed") {
          totals.taskDurationSeconds += taskDurationSecondsFromItem(item);
          totals.earnedTaskCoins += taskEarnedCoinsFromItem(item);
        }
        if (item.type === "reward_redeemed") {
          totals.coinsSpent += parseAmount(item.cost);
        }
        if (item.type === "fund_deposit") {
          totals.coinsSpent += parseCoinAmount(item.amount);
        }
        if (item.type === "task_failed" || item.type === "habit_failed") {
          totals.coinsPenalty += parseCoinAmount(item.coins);
        }
        if (item.type === "task_missed" || item.type === "bad_habit") {
          totals.coinsPenalty += parseAmount(item.coins);
        }
        if (item.type === "priority_task_penalty") {
          totals.coinsPenalty += parseCoinAmount(item.coins);
        }
        return totals;
      }, {
        completedTasks: 0,
        coinsSpent: 0,
        coinsPenalty: 0,
        taskDurationSeconds: 0,
        earnedTaskCoins: 0
      });
    }

    function setCoinReadouts(value) {
      const formatted = formatCoinAmount(value);
      [els.homeCoins, els.badCoins, els.rewardCoins, els.statCoins].forEach(target => {
        if (target) target.textContent = formatted;
      });
    }

    function animateCoinBalance(from, to, duration = 720) {
      const targets = [els.homeCoins, els.badCoins, els.rewardCoins, els.statCoins].filter(Boolean);
      targets.forEach(target => {
        target.classList.remove("coin-pulse-positive", "coin-pulse-negative", "coin-pulse-gold");
        void target.offsetWidth;
        target.classList.add("coin-pulse-gold");
      });

      const now = window.performance?.now ? () => window.performance.now() : () => Date.now();
      const frame = window.requestAnimationFrame
        ? callback => window.requestAnimationFrame(callback)
        : callback => setTimeout(() => callback(now()), 16);
      const start = now();
      const change = to - from;
      const tick = timestamp => {
        const progress = Math.min(1, (timestamp - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCoinReadouts(parseCoinAmount(from + change * eased));
        if (progress < 1) frame(tick);
        else setCoinReadouts(to);
      };
      frame(tick);
    }

    function updatePrimaryReadouts() {
      const streak = currentStreak();
      const activeCount = activeTasksToday().length;
      const totals = summaryTotals();
      setCoinReadouts(state.coins);
      if (els.homeStreak) els.homeStreak.textContent = formatNumber(streak);
      els.todayTaskCount.textContent = `${activeCount} 项`;
      if (els.statStreak) els.statStreak.textContent = formatNumber(streak);
      if (els.statCompleted) els.statCompleted.textContent = formatNumber(totals.completedTasks);
      if (els.statCoins) els.statCoins.textContent = formatCoinAmount(state.coins);
      if (els.statSpent) els.statSpent.textContent = formatNumber(totals.coinsSpent);
      if (els.statPenalty) els.statPenalty.textContent = formatNumber(totals.coinsPenalty);
    }

    function promptNextStepAfterCompletion() {
      if (typeof openTaskSheet !== "function") return;
      window.setTimeout(() => openTaskSheet(), 0);
    }
    function startTask(taskId, sourceEl = null) {
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId)) return;
      if (!taskHasTime(task)) return;
      if (taskStatusToday(task) === "running") return;

      const startTime = new Date().toISOString();
      state.tasks = state.tasks.map(item => (
        item.id === taskId
          ? {
              ...item,
              status: "running",
              startTime,
              endTime: null,
              durationMinutes: null,
              durationSeconds: null,
              earnedCoins: null,
              updatedAt: startTime
            }
          : item
      ));
      saveState();
      render();
    }

    function finishTask(taskId, sourceEl = null) {
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId) || taskStatusToday(task) !== "running") return;
      if (!taskHasTime(task)) return;

      const today = dateKey();
      const endTime = new Date().toISOString();
      const previousTask = taskPreviousState(task);
      const previousProgress = progressSnapshot(today, task.id);
      const { durationSeconds, durationMinutes, earnedCoins } = taskDurationPayload(
        task.startTime,
        endTime,
        taskRewardAmount(task)
      );
      state.tasks = state.tasks.map(item => (
        item.id === taskId
          ? {
              ...item,
              status: "completed",
              endTime,
              durationSeconds,
              durationMinutes,
              earnedCoins,
              updatedAt: endTime
            }
          : item
      ));
      state.completions[today] = state.completions[today] || {};
      state.completions[today][taskId] = true;
      state.taskResults[today] = state.taskResults[today] || {};
      state.taskResults[today][taskId] = "completed";
      state.totals.completedTasks = (Number(state.totals.completedTasks) || 0) + 1;
      state.totals.taskDurationSeconds = (Number(state.totals.taskDurationSeconds) || 0) + durationSeconds;
      state.totals.earnedTaskCoins = parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) + earnedCoins);
      updateStreakForCompletion(today);
      const coinEvent = recordCoinEvent({
        type: "task_completed",
        amount: earnedCoins,
        date: today,
        history: {
          taskId: task.id,
          name: task.name,
          coins: earnedCoins,
          earnedCoins,
          durationMinutes,
          durationSeconds,
          startTime: task.startTime,
          endTime
        }
      });
      const historyId = coinEvent.historyId;
      clearNextStepForTask(taskId);
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-success");
      showCoinFeedback(earnedCoins, "positive", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showTaskRewardToast({
        earnedCoins,
        durationSeconds,
        currentCoins: state.coins,
        showDuration: true,
        undoData: {
          type: "task_completed",
          historyId,
          taskId: task.id,
          date: today,
          amount: earnedCoins,
          durationSeconds,
          previousTask,
          previousProgress
        }
      });
      promptNextStepAfterCompletion();
    }

    function completeTask(taskId, sourceEl = null) {
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId)) return;
      if (taskHasTime(task)) {
        finishTask(taskId, sourceEl);
        return;
      }

      const today = dateKey();
      const completedAt = new Date().toISOString();
      const earnedCoins = taskRewardAmount(task);
      const previousTask = taskPreviousState(task);
      const previousProgress = progressSnapshot(today, task.id);
      state.tasks = state.tasks.map(item => (
        item.id === taskId
          ? {
              ...item,
              status: "completed",
              endTime: completedAt,
              durationMinutes: 0,
              durationSeconds: 0,
              earnedCoins,
              updatedAt: completedAt
            }
          : item
      ));
      state.completions[today] = state.completions[today] || {};
      state.completions[today][taskId] = true;
      state.taskResults[today] = state.taskResults[today] || {};
      state.taskResults[today][taskId] = "completed";
      state.totals.completedTasks = (Number(state.totals.completedTasks) || 0) + 1;
      state.totals.earnedTaskCoins = parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) + earnedCoins);
      updateStreakForCompletion(today);
      const coinEvent = recordCoinEvent({
        type: "task_completed",
        amount: earnedCoins,
        date: today,
        timestamp: completedAt,
        history: {
          taskId: task.id,
          name: task.name,
          coins: earnedCoins,
          earnedCoins,
          durationMinutes: 0,
          durationSeconds: 0,
          startTime: null,
          endTime: completedAt
        }
      });
      const historyId = coinEvent.historyId;
      clearNextStepForTask(taskId);
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-success");
      showCoinFeedback(earnedCoins, "positive", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showTaskRewardToast({
        earnedCoins,
        currentCoins: state.coins,
        undoData: {
          type: "task_completed",
          historyId,
          taskId: task.id,
          date: today,
          amount: earnedCoins,
          durationSeconds: 0,
          previousTask,
          previousProgress
        }
      });
      promptNextStepAfterCompletion();
    }

    function completePriorityTask(day = dateKey(), sourceEl = null) {
      const date = normalizeReviewDateKey(day);
      const task = priorityTaskForDate(date);
      if (!task || task.status !== "pending") return;

      const completedAt = new Date().toISOString();
      const previousTask = priorityTaskSnapshot(task);
      const amount = priorityTaskSettlementAmount("done");
      ensurePriorityTasks()[date] = {
        ...task,
        status: "done",
        completedAt,
        rewardHistoryId: null,
        updatedAt: completedAt
      };
      const coinEvent = recordCoinEvent({
        type: "priority_task_reward",
        amount,
        date,
        timestamp: completedAt,
        history: {
          name: task.title,
          coins: amount
        }
      });
      const historyId = coinEvent.historyId;
      ensurePriorityTasks()[date].rewardHistoryId = historyId;
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-success");
      showCoinFeedback(amount, "positive", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showUndoToast({
        type: "priority_task_reward",
        historyId,
        date,
        amount,
        previousTask
      }, {
        icon: "checkmark.circle",
        lines: [
          "✓ 已完成今天最重要的一件事",
          `获得 ${formatNumber(amount)} 金币`
        ],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "positive"
      });
    }

    function failPriorityTask(day = dateKey(), sourceEl = null) {
      const date = normalizeReviewDateKey(day);
      const task = priorityTaskForDate(date);
      if (!task || task.status !== "pending") return;

      const failedAt = new Date().toISOString();
      const previousTask = priorityTaskSnapshot(task);
      const amount = priorityTaskSettlementAmount("failed");
      ensurePriorityTasks()[date] = {
        ...task,
        status: "failed",
        failedAt,
        settledPenalty: true,
        penaltyHistoryId: null,
        updatedAt: failedAt
      };
      const coinEvent = recordCoinEvent({
        type: "priority_task_penalty",
        amount: -amount,
        date,
        timestamp: failedAt,
        history: {
          name: task.title,
          coins: amount
        }
      });
      const historyId = coinEvent.historyId;
      ensurePriorityTasks()[date].penaltyHistoryId = historyId;
      state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-failure");
      showCoinFeedback(amount, "negative", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showUndoToast({
        type: "priority_task_penalty",
        historyIds: [historyId],
        priorityEntries: [{ historyId, date, amount, previousTask }],
        amount
      }, {
        icon: "xmark.circle",
        lines: [
          "今天最重要的一件事未完成",
          `扣除 ${formatNumber(amount)} 金币`
        ],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "negative"
      });
    }

    function completeHabit(habitId, sourceEl = null) {
      const habit = state.habits.find(item => item.id === habitId);
      if (!habit || habitCompletedToday(habitId)) return;

      const today = dateKey();
      const amount = parseAmount(habit.coins);
      const previousProgress = habitProgressSnapshot(today, habit.id);
      state.habitCompletions[today] = state.habitCompletions[today] || {};
      state.habitCompletions[today][habitId] = true;
      updateStreakForCompletion(today);
      const coinEvent = recordCoinEvent({
        type: "habit_completed",
        date: today,
        amount,
        history: {
          habitId: habit.id,
          name: habit.name,
          coins: amount
        }
      });
      const historyId = coinEvent.historyId;
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-success");
      showCoinFeedback(amount, "positive", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showUndoToast({
        type: "habit_completed",
        historyId,
        habitId: habit.id,
        date: today,
        amount,
        previousProgress
      }, {
        icon: "checkmark.circle",
        lines: [
          `获得 ${formatCoinAmount(amount)} 金币`,
          "习惯已完成",
          `当前金币 ${formatCoinAmount(state.coins)}`
        ],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "positive"
      });
      promptNextStepAfterCompletion();
    }

    function failTask(taskId, sourceEl = null) {
      const task = todayTasks().find(item => item.id === taskId);
      if (!task || taskResultToday(taskId)) return;

      const today = dateKey();
      const amount = taskFailurePenalty(task);
      const previousTask = {
        status: task.status || "pending",
        startTime: task.startTime || null,
        endTime: task.endTime || null,
        durationMinutes: task.durationMinutes ?? null,
        durationSeconds: task.durationSeconds ?? null,
        earnedCoins: task.earnedCoins ?? null
      };

      state.tasks = state.tasks.map(item => (
        item.id === taskId
          ? {
              ...item,
              status: "failed",
              failedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          : item
      ));
      state.taskResults[today] = state.taskResults[today] || {};
      state.taskResults[today][taskId] = "failed";
      state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
      const coinEvent = recordCoinEvent({
        type: "task_failed",
        amount: -amount,
        date: today,
        history: {
          taskId: task.id,
          name: task.name,
          coins: amount
        }
      });
      const historyId = coinEvent.historyId;
      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-penalty");
      showCoinFeedback(amount, "negative", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showUndoToast({
        type: "task_failed",
        historyId,
        taskId: task.id,
        date: today,
        amount,
        previousTask
      }, {
        icon: "xmark.circle",
        lines: [
          `扣除 ${formatCoinAmount(amount)} 金币`,
          "任务未完成",
          `当前金币 ${formatCoinAmount(state.coins)}`
        ],
        undoLabel: "撤回",
        duration: 5000
      });
    }

    function ensureDayRecord(collection, day) {
      state[collection] = state[collection] && typeof state[collection] === "object" ? state[collection] : {};
      state[collection][day] = state[collection][day] && typeof state[collection][day] === "object" ? state[collection][day] : {};
      return state[collection][day];
    }

    function settleMissedHabits(day = yesterdayKey()) {
      let totalPenalty = 0;
      let count = 0;
      const entries = [];
      state.habits.forEach(habit => {
        if (!habitActiveOnDate(habit, day)) return;
        if (habitCompletedOnDate(habit.id, day)) return;
        if (habitFailedOnDate(habit.id, day)) return;

        const amount = 10;
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        const coinEvent = recordCoinEvent({
          type: "habit_failed",
          amount: -amount,
          date: day,
          history: {
            habitId: habit.id,
            name: habit.name,
            coins: amount,
            reason: "habit_missed"
          }
        });
        const historyId = coinEvent.historyId;
        ensureDayRecord("habitFailures", day)[habit.id] = historyId;
        entries.push({
          historyId,
          habitId: habit.id,
          date: day,
          amount
        });
        totalPenalty = parseCoinAmount(totalPenalty + amount);
        count += 1;
      });
      return { count, totalPenalty, entries };
    }

    function taskAutoFailedOnDate(taskId, day) {
      return Boolean(state.taskAutoFailures?.[day]?.[taskId]);
    }

    function taskPreviousState(task) {
      return {
        status: task.status || "pending",
        startTime: task.startTime || null,
        endTime: task.endTime || null,
        durationMinutes: task.durationMinutes ?? null,
        durationSeconds: task.durationSeconds ?? null,
        earnedCoins: task.earnedCoins ?? null,
        failedAt: task.failedAt || null
      };
    }

    function progressSnapshot(day, taskId = null) {
      return {
        taskResult: taskId ? state.taskResults?.[day]?.[taskId] || null : null,
        taskCompletion: taskId ? Boolean(state.completions?.[day]?.[taskId]) : false,
        streak: Number(state.streak) || 0,
        lastCompletedDate: state.lastCompletedDate || null
      };
    }

    function habitProgressSnapshot(day, habitId) {
      return {
        habitCompletion: Boolean(state.habitCompletions?.[day]?.[habitId]),
        streak: Number(state.streak) || 0,
        lastCompletedDate: state.lastCompletedDate || null
      };
    }

    function removeDayValue(collection, day, id) {
      if (!state[collection]?.[day]) return;
      delete state[collection][day][id];
      if (!Object.keys(state[collection][day]).length) {
        delete state[collection][day];
      }
    }

    function restoreStreakSnapshot(snapshot) {
      if (!snapshot) return;
      state.streak = Number(snapshot.streak) || 0;
      state.lastCompletedDate = snapshot.lastCompletedDate || null;
    }

    function restoreTaskProgress(day, taskId, snapshot) {
      if (snapshot?.taskCompletion) {
        state.completions[day] = state.completions[day] || {};
        state.completions[day][taskId] = true;
      } else {
        removeDayValue("completions", day, taskId);
      }

      if (snapshot?.taskResult) {
        state.taskResults[day] = state.taskResults[day] || {};
        state.taskResults[day][taskId] = snapshot.taskResult;
      } else {
        removeDayValue("taskResults", day, taskId);
      }
      restoreStreakSnapshot(snapshot);
    }

    function restoreHabitProgress(day, habitId, snapshot) {
      if (snapshot?.habitCompletion) {
        state.habitCompletions[day] = state.habitCompletions[day] || {};
        state.habitCompletions[day][habitId] = true;
      } else {
        removeDayValue("habitCompletions", day, habitId);
      }
      restoreStreakSnapshot(snapshot);
    }

    function restoreTaskState(taskId, previousTask) {
      state.tasks = state.tasks.map(task => (
        task.id === taskId
          ? {
              ...task,
              status: previousTask?.status || "pending",
              startTime: previousTask?.startTime || null,
              endTime: previousTask?.endTime || null,
              durationMinutes: previousTask?.durationMinutes ?? null,
              durationSeconds: previousTask?.durationSeconds ?? null,
              earnedCoins: previousTask?.earnedCoins ?? null,
              failedAt: previousTask?.failedAt || null,
              updatedAt: new Date().toISOString()
            }
          : task
      ));
    }

    function settleTimedTaskTimeouts(now = new Date()) {
      const today = dateKey(now);
      const entries = [];
      let totalPenalty = 0;

      todayTasks().forEach(task => {
        if (!taskHasTime(task)) return;
        if (taskResultToday(task.id)) return;
        if (taskAutoFailedOnDate(task.id, today)) return;
        if (!taskPastEndTime(task, now)) return;

        const amount = taskFailurePenalty(task);
        const failedAt = now.toISOString();
        const previousTask = taskPreviousState(task);

        state.tasks = state.tasks.map(item => (
          item.id === task.id
            ? {
                ...item,
                status: "failed",
                failedAt,
                updatedAt: failedAt
              }
            : item
        ));
        state.taskResults[today] = state.taskResults[today] || {};
        state.taskResults[today][task.id] = "failed";
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        const coinEvent = recordCoinEvent({
          type: "task_failed",
          amount: -amount,
          date: today,
          timestamp: failedAt,
          history: {
            taskId: task.id,
            name: task.name,
            coins: amount,
            reason: "timeout"
          }
        });
        const historyId = coinEvent.historyId;
        ensureDayRecord("taskAutoFailures", today)[task.id] = historyId;
        entries.push({
          historyId,
          taskId: task.id,
          date: today,
          amount,
          previousTask
        });
        totalPenalty = parseCoinAmount(totalPenalty + amount);
      });

      return { count: entries.length, totalPenalty, entries };
    }

    function settleMissedPriorityTasks(now = new Date()) {
      const today = dateKey(now);
      const tasksByDate = ensurePriorityTasks();
      const entries = [];
      let totalPenalty = 0;

      Object.entries(tasksByDate).forEach(([day, task]) => {
        if (!task || day >= today) return;
        if (task.status !== "pending") return;
        if (task.settledPenalty) return;

        const amount = priorityTaskSettlementAmount("failed");
        const failedAt = now.toISOString();
        const previousTask = priorityTaskSnapshot(task);
        const coinEvent = recordCoinEvent({
          type: "priority_task_penalty",
          amount: -amount,
          date: day,
          timestamp: failedAt,
          history: {
            name: task.title,
            coins: amount
          }
        });
        const historyId = coinEvent.historyId;

        tasksByDate[day] = {
          ...task,
          status: "failed",
          failedAt,
          settledPenalty: true,
          penaltyHistoryId: historyId,
          updatedAt: failedAt
        };
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        entries.push({
          historyId,
          date: day,
          amount,
          previousTask
        });
        totalPenalty = parseCoinAmount(totalPenalty + amount);
      });

      return { count: entries.length, totalPenalty, entries };
    }

    function badHabitRecordedOnDate(day) {
      return state.history.some(item => item.type === "bad_habit" && item.date === day);
    }

    function noBadHabitBonusSettled(day) {
      return Boolean(ensureNoBadHabitBonuses()[day]);
    }

    function awardNoBadHabitBonusForDate(day, now = new Date(), reason = "correction") {
      if (noBadHabitBonusSettled(day)) return null;
      if (badHabitRecordedOnDate(day)) return null;

      const awardedAt = now.toISOString();
      const coinEvent = recordCoinEvent({
        type: "no_bad_habit_bonus",
        amount: NO_BAD_HABIT_BONUS,
        date: day,
        timestamp: awardedAt,
        history: {
          name: "无坏习惯奖励",
          coins: NO_BAD_HABIT_BONUS,
          reason
        }
      });
      const historyId = coinEvent.historyId;
      ensureNoBadHabitBonuses()[day] = {
        status: "awarded",
        historyId,
        awardedAt,
        reason
      };
      return {
        historyId,
        date: day,
        amount: NO_BAD_HABIT_BONUS
      };
    }

    function settleNoBadHabitBonuses(now = new Date()) {
      const today = dateKey(now);
      const lastDayToCheck = shiftDateKey(today, -1);
      let checkedThrough = state.noBadHabitBonusCheckedThroughDate || shiftDateKey(lastDayToCheck, -1);
      const previousCheckedThrough = checkedThrough;
      const entries = [];
      let totalBonus = 0;

      while (checkedThrough < lastDayToCheck) {
        const day = shiftDateKey(checkedThrough, 1);
        checkedThrough = day;

        if (noBadHabitBonusSettled(day)) continue;
        if (badHabitRecordedOnDate(day)) continue;

        const entry = awardNoBadHabitBonusForDate(day, now, "daily_settlement");
        if (!entry) continue;
        entries.push(entry);
        totalBonus = parseCoinAmount(totalBonus + NO_BAD_HABIT_BONUS);
      }

      state.noBadHabitBonusCheckedThroughDate = lastDayToCheck;
      return {
        count: entries.length,
        totalBonus,
        entries,
        checkedThroughChanged: previousCheckedThrough !== lastDayToCheck
      };
    }

    function noBadHabitBonusToastLines(result) {
      const firstEntry = result.entries[0];
      const firstLine = result.count === 1 && firstEntry?.date === yesterdayKey()
        ? "✓ 昨天没有坏习惯"
        : result.count === 1
          ? `✓ ${formatFullDateKey(firstEntry.date)} 没有坏习惯`
          : `✓ ${formatNumber(result.count)} 天没有坏习惯`;
      return [
        firstLine,
        `获得 ${formatNumber(result.totalBonus)} 金币`
      ];
    }

    function showNoBadHabitBonusToast(result) {
      if (!result.count) return;
      showUndoToast({
        type: "no_bad_habit_bonus",
        historyIds: result.entries.map(entry => entry.historyId),
        bonusEntries: result.entries,
        amount: result.totalBonus
      }, {
        icon: "checkmark.circle",
        lines: noBadHabitBonusToastLines(result),
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "positive"
      });
    }

    function runAutomaticChecks(options = {}) {
      const { showToast: shouldShowToast = true } = options;
      const habitResult = settleMissedHabits();
      const taskResult = settleTimedTaskTimeouts();
      const priorityResult = settleMissedPriorityTasks();
      const bonusResult = settleNoBadHabitBonuses();
      const changed = habitResult.count > 0
        || taskResult.count > 0
        || priorityResult.count > 0
        || bonusResult.count > 0
        || bonusResult.checkedThroughChanged;
      if (!changed) return false;

      saveState();
      updatePrimaryReadouts();

      if (
        shouldShowToast
        && priorityResult.count > 0
        && habitResult.count === 0
        && taskResult.count === 0
      ) {
        showUndoToast({
          type: "priority_task_penalty",
          historyIds: [
            ...priorityResult.entries.map(entry => entry.historyId),
            ...bonusResult.entries.map(entry => entry.historyId)
          ],
          priorityEntries: priorityResult.entries,
          bonusEntries: bonusResult.entries,
          bonusAmount: bonusResult.totalBonus,
          amount: priorityResult.totalPenalty
        }, {
          icon: "xmark.circle",
          lines: [
            "今天最重要的一件事未完成",
            `扣除 ${formatNumber(priorityResult.totalPenalty)} 金币`,
            bonusResult.count > 0 ? `同时获得 ${formatCoinAmount(bonusResult.totalBonus)} 金币` : ""
          ].filter(Boolean),
          undoLabel: "撤回",
          duration: 5000
        });
      } else if (shouldShowToast && (habitResult.count > 0 || taskResult.count > 0 || priorityResult.count > 0)) {
        const historyIds = [
          ...taskResult.entries.map(entry => entry.historyId),
          ...habitResult.entries.map(entry => entry.historyId),
          ...priorityResult.entries.map(entry => entry.historyId),
          ...bonusResult.entries.map(entry => entry.historyId)
        ];
        const totalPenalty = parseCoinAmount(taskResult.totalPenalty + habitResult.totalPenalty + priorityResult.totalPenalty);
        const reasons = [
          taskResult.count > 0 ? "任务超时未完成" : "",
          habitResult.count > 0 ? "习惯未完成" : "",
          priorityResult.count > 0 ? "今天最重要的一件事未完成" : ""
        ].filter(Boolean).join(" / ");

        showUndoToast({
          type: "automatic_failures",
          historyIds,
          taskEntries: taskResult.entries,
          habitEntries: habitResult.entries,
          priorityEntries: priorityResult.entries,
          bonusEntries: bonusResult.entries,
          bonusAmount: bonusResult.totalBonus,
          amount: totalPenalty
        }, {
          icon: "xmark.circle",
          lines: [
            `已自动扣除 ${formatCoinAmount(totalPenalty)} 金币`,
            bonusResult.count > 0 ? `同时获得 ${formatCoinAmount(bonusResult.totalBonus)} 金币` : "",
            `原因：${reasons}`,
            `当前金币 ${formatCoinAmount(state.coins)}`
          ].filter(Boolean),
          undoLabel: "撤回",
          duration: 5000
        });
      } else if (shouldShowToast && bonusResult.count > 0) {
        showNoBadHabitBonusToast(bonusResult);
      }

      return true;
    }

    function cloneForUndo(value) {
      if (value === undefined || value === null) return value;
      return JSON.parse(JSON.stringify(value));
    }

    function historyCoinDelta(item) {
      if (item?.coinDelta !== undefined && item.coinDelta !== null && item.coinDelta !== "") {
        return parseCoinAmount(item.coinDelta);
      }
      if (item?.type === "task_completed") return taskEarnedCoinsFromItem(item);
      if (item?.type === "habit_completed") return parseAmount(item.coins);
      if (item?.type === "review_reward") return parseCoinAmount(item.coins);
      if (item?.type === "priority_task_reward") return parseCoinAmount(item.coins);
      if (item?.type === "no_bad_habit_bonus") return parseCoinAmount(item.coins);
      if (item?.type === "task_failed" || item?.type === "habit_failed" || item?.type === "priority_task_penalty") {
        return -parseCoinAmount(item.coins);
      }
      if (item?.type === "task_missed" || item?.type === "bad_habit") return -parseAmount(item.coins);
      if (item?.type === "reward_redeemed") return -parseAmount(item.cost);
      if (item?.type === "fund_deposit") return -parseCoinAmount(item.amount);
      return 0;
    }

    function historyCorrectionName(item) {
      const names = {
        task_completed: "任务完成纠错",
        task_failed: "任务失败纠错",
        task_missed: "任务失败纠错",
        habit_completed: "习惯完成纠错",
        habit_failed: "习惯失败纠错",
        bad_habit: "坏习惯纠错",
        fund_deposit: "基金注入纠错",
        reward_redeemed: "奖励兑换纠错",
        review_reward: "复盘奖励纠错",
        priority_task_reward: "重点事项纠错",
        priority_task_penalty: "重点事项纠错",
        no_bad_habit_bonus: "无坏习惯奖励纠错"
      };
      return names[item?.type] || "当天记录纠错";
    }

    function correctionSnapshot(day, item = {}) {
      return {
        day,
        totals: cloneForUndo(state.totals),
        streak: Number(state.streak) || 0,
        lastCompletedDate: state.lastCompletedDate || null,
        task: item.taskId ? cloneForUndo(state.tasks.find(task => task.id === item.taskId)) : null,
        taskResult: item.taskId ? cloneForUndo(state.taskResults?.[day]?.[item.taskId] || null) : null,
        taskCompletion: item.taskId ? Boolean(state.completions?.[day]?.[item.taskId]) : false,
        taskAutoFailure: item.taskId ? cloneForUndo(state.taskAutoFailures?.[day]?.[item.taskId] || null) : null,
        habitCompletion: item.habitId ? Boolean(state.habitCompletions?.[day]?.[item.habitId]) : false,
        habitFailure: item.habitId ? cloneForUndo(state.habitFailures?.[day]?.[item.habitId] || null) : null,
        priorityTask: cloneForUndo(priorityTaskForDate(day)),
        review: cloneForUndo(state.dailyReviews?.[day]),
        reviewReward: cloneForUndo(state.reviewRewards?.[day]),
        noBadHabitBonus: cloneForUndo(state.noBadHabitBonuses?.[day]),
        fund: item.rewardId ? cloneForUndo(state.rewards.find(fund => fund.id === item.rewardId)) : null,
        achievement: item.achievementId ? cloneForUndo((state.achievements || []).find(achievement => achievement.id === item.achievementId)) : null
      };
    }

    function restoreCorrectionSnapshot(snapshot, item = {}) {
      if (!snapshot) return;
      state.totals = cloneForUndo(snapshot.totals) || state.totals;
      state.streak = Number(snapshot.streak) || 0;
      state.lastCompletedDate = snapshot.lastCompletedDate || null;

      if (item.taskId) {
        if (snapshot.task) {
          state.tasks = state.tasks.map(task => task.id === item.taskId ? { ...task, ...snapshot.task } : task);
          if (!state.tasks.some(task => task.id === item.taskId)) state.tasks.push(cloneForUndo(snapshot.task));
        }
        if (snapshot.taskResult) {
          state.taskResults[stagingDay(snapshot.day)] = state.taskResults[stagingDay(snapshot.day)] || {};
          state.taskResults[stagingDay(snapshot.day)][item.taskId] = snapshot.taskResult;
        } else {
          removeDayValue("taskResults", snapshot.day, item.taskId);
        }
        if (snapshot.taskCompletion) {
          state.completions[snapshot.day] = state.completions[snapshot.day] || {};
          state.completions[snapshot.day][item.taskId] = true;
        } else {
          removeDayValue("completions", snapshot.day, item.taskId);
        }
        if (snapshot.taskAutoFailure) {
          state.taskAutoFailures[snapshot.day] = state.taskAutoFailures[snapshot.day] || {};
          state.taskAutoFailures[snapshot.day][item.taskId] = snapshot.taskAutoFailure;
        } else {
          removeDayValue("taskAutoFailures", snapshot.day, item.taskId);
        }
      }

      if (item.habitId) {
        if (snapshot.habitCompletion) {
          state.habitCompletions[snapshot.day] = state.habitCompletions[snapshot.day] || {};
          state.habitCompletions[snapshot.day][item.habitId] = true;
        } else {
          removeDayValue("habitCompletions", snapshot.day, item.habitId);
        }
        if (snapshot.habitFailure) {
          state.habitFailures[snapshot.day] = state.habitFailures[snapshot.day] || {};
          state.habitFailures[snapshot.day][item.habitId] = snapshot.habitFailure;
        } else {
          removeDayValue("habitFailures", snapshot.day, item.habitId);
        }
      }

      restorePriorityTask(snapshot.day, snapshot.priorityTask);

      if (snapshot.review) {
        state.dailyReviews[snapshot.day] = cloneForUndo(snapshot.review);
      } else if (state.dailyReviews?.[snapshot.day]) {
        delete state.dailyReviews[snapshot.day];
      }
      state.reviewRewards = state.reviewRewards && typeof state.reviewRewards === "object" ? state.reviewRewards : {};
      if (snapshot.reviewReward) state.reviewRewards[snapshot.day] = snapshot.reviewReward;
      else delete state.reviewRewards[snapshot.day];

      state.noBadHabitBonuses = state.noBadHabitBonuses && typeof state.noBadHabitBonuses === "object" ? state.noBadHabitBonuses : {};
      if (snapshot.noBadHabitBonus) state.noBadHabitBonuses[snapshot.day] = cloneForUndo(snapshot.noBadHabitBonus);
      else delete state.noBadHabitBonuses[snapshot.day];

      if (item.rewardId && snapshot.fund) {
        state.rewards = state.rewards.map(fund => fund.id === item.rewardId ? cloneForUndo(snapshot.fund) : fund);
      }
      if (snapshot.achievement) {
        state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
        if (!state.achievements.some(achievement => achievement.id === snapshot.achievement.id)) {
          state.achievements.unshift(cloneForUndo(snapshot.achievement));
        }
      }
    }

    function stagingDay(day) {
      return normalizeReviewDateKey(day);
    }

    function removeHistoryEntry(item) {
      removeCoinHistoryByIds([item.id]);
    }

    function insertHistoryEntries(entries = []) {
      state.history = [
        ...entries.map(cloneForUndo),
        ...state.history
      ].sort((left, right) => String(right.timestamp || "").localeCompare(String(left.timestamp || "")));
    }

    function resetTaskAfterRecordDeletion(item, day) {
      if (!item.taskId) return;
      removeDayValue("taskResults", day, item.taskId);
      removeDayValue("completions", day, item.taskId);
      removeDayValue("taskAutoFailures", day, item.taskId);
      state.tasks = state.tasks.map(task => (
        task.id === item.taskId
          ? {
              ...task,
              status: "pending",
              startTime: null,
              endTime: null,
              durationMinutes: null,
              durationSeconds: null,
              earnedCoins: null,
              failedAt: null,
              updatedAt: new Date().toISOString()
            }
          : task
      ));
    }

    function applyHistoryRecordDeletion(item, day) {
      if (item.type === "task_completed") {
        resetTaskAfterRecordDeletion(item, day);
      }
      if (item.type === "task_failed" || item.type === "task_missed") {
        resetTaskAfterRecordDeletion(item, day);
      }
      if (item.type === "habit_completed") {
        removeDayValue("habitCompletions", day, item.habitId);
      }
      if (item.type === "habit_failed") {
        removeDayValue("habitFailures", day, item.habitId);
      }
      if (item.type === "priority_task_reward" || item.type === "priority_task_penalty") {
        const task = priorityTaskForDate(day);
        if (task) {
          restorePriorityTask(day, {
            ...task,
            status: "pending",
            completedAt: null,
            failedAt: null,
            settledPenalty: false,
            rewardHistoryId: null,
            penaltyHistoryId: null,
            updatedAt: new Date().toISOString()
          });
        }
      }
      if (item.type === "review_reward") {
        state.reviewRewards = state.reviewRewards && typeof state.reviewRewards === "object" ? state.reviewRewards : {};
        if (state.reviewRewards[day] === item.id) delete state.reviewRewards[day];
      }
      if (item.type === "no_bad_habit_bonus") {
        state.noBadHabitBonuses = state.noBadHabitBonuses && typeof state.noBadHabitBonuses === "object" ? state.noBadHabitBonuses : {};
        state.noBadHabitBonuses[day] = {
          status: "dismissed",
          dismissedAt: new Date().toISOString()
        };
      }
      if (item.type === "fund_deposit" && item.rewardId) {
        const amount = parseCoinAmount(item.amount);
        state.rewards = state.rewards.map(fund => {
          if (fund.id !== item.rewardId) return fund;
          const nextCurrentCoins = Math.max(0, parseCoinAmount(fundCurrentCoins(fund) - amount));
          const nextFund = {
            ...fund,
            currentCoins: nextCurrentCoins,
            updatedAt: new Date().toISOString()
          };
          if (nextCurrentCoins < fundTotalCoins(fund)) {
            nextFund.completedAt = null;
            nextFund.achievementId = null;
          }
          return nextFund;
        });
        if (item.achievementId) {
          state.achievements = (Array.isArray(state.achievements) ? state.achievements : [])
            .filter(achievement => achievement.id !== item.achievementId);
        }
      }
      if (item.type === "reward_redeemed") {
        state.totals.coinsSpent = Math.max(0, parseCoinAmount((Number(state.totals.coinsSpent) || 0) - parseAmount(item.cost)));
      }
      if (item.type === "fund_deposit") {
        state.totals.coinsSpent = Math.max(0, parseCoinAmount((Number(state.totals.coinsSpent) || 0) - parseCoinAmount(item.amount)));
      }
      if (item.type === "task_failed" || item.type === "task_missed" || item.type === "habit_failed" || item.type === "bad_habit" || item.type === "priority_task_penalty") {
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - Math.abs(historyCoinDelta(item))));
      }
      if (item.type === "task_completed") {
        state.totals.completedTasks = Math.max(0, (Number(state.totals.completedTasks) || 0) - 1);
        state.totals.taskDurationSeconds = Math.max(0, (Number(state.totals.taskDurationSeconds) || 0) - taskDurationSecondsFromItem(item));
        state.totals.earnedTaskCoins = Math.max(0, parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) - taskEarnedCoinsFromItem(item)));
      }
    }

    function refreshAfterDayRecordCorrection(day) {
      saveState();
      updatePrimaryReadouts();
      renderHeatmap();
      renderHabitTrend(buildStatsRows(currentStatsRange));
      renderAchievements();
      renderRewards();
      renderTasks();
      renderHabits();
      renderPriorityTask();
      renderDailyReview();
      if (!els.dayDetailBackdrop.classList.contains("hidden")) {
        if (dayHasEditableRecords(day)) {
          els.dayDetailContent.innerHTML = buildDayDetailHtml(day);
        } else {
          closeDayDetail();
        }
      }
    }

    function recordDeletionCorrection({ originalEntries, snapshot, amount, day, title, type = "day_record_delete" }) {
      const timestamp = new Date().toISOString();
      const correctionEvent = recordCoinEvent({
        type: "day_record_correction",
        amount,
        date: day,
        timestamp,
        history: {
          name: title,
          coins: Math.abs(amount),
          correctedHistoryIds: originalEntries.map(entry => entry.id)
        }
      });
      return {
        type,
        historyIds: [correctionEvent.historyId],
        correctionDelta: correctionEvent.amount,
        originalEntries: originalEntries.map(cloneForUndo),
        snapshot,
        date: day
      };
    }

    async function deleteHistoryDayRecord(historyId) {
      const item = state.history.find(entry => entry.id === historyId);
      if (!item) {
        showToast("找不到这条记录");
        return;
      }
      const day = item.date || dateKey();
      const confirmed = await askForConfirmation({
        title: "删除这条记录？",
        message: "这会同步修正当天统计和相关金币记录。",
        confirmText: "删除"
      });
      if (!confirmed) return;

      const snapshot = correctionSnapshot(day, item);
      const originalEntries = [cloneForUndo(item)];
      const undoData = recordDeletionCorrection({
        originalEntries,
        snapshot,
        amount: -historyCoinDelta(item),
        day,
        title: historyCorrectionName(item)
      });
      removeHistoryEntry(item);
      applyHistoryRecordDeletion(item, day);

      const bonusEntry = item.type === "bad_habit" && !badHabitRecordedOnDate(day)
        ? awardNoBadHabitBonusForDate(day, new Date(), "bad_habit_correction")
        : null;
      if (bonusEntry) {
        undoData.historyIds.push(bonusEntry.historyId);
        undoData.correctionDelta = parseCoinAmount(undoData.correctionDelta + bonusEntry.amount);
      }

      refreshAfterDayRecordCorrection(day);
      showUndoToast(undoData, {
        icon: "checkmark.circle",
        lines: bonusEntry
          ? ["✓ 当天已恢复为无坏习惯", "获得 2 金币", "已删除记录"]
          : ["已删除记录", "已同步修正当天统计"],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "positive"
      });
    }

    async function deletePriorityDayRecord(dayKeyValue) {
      const day = normalizeReviewDateKey(dayKeyValue);
      const task = priorityTaskForDate(day);
      if (!task) {
        showToast("找不到这条记录");
        return;
      }
      const confirmed = await askForConfirmation({
        title: "删除这条记录？",
        message: "这会同步修正当天统计和相关金币记录。",
        confirmText: "删除"
      });
      if (!confirmed) return;

      const ids = [task.rewardHistoryId, task.penaltyHistoryId].filter(Boolean);
      const originalEntries = ids
        .map(id => state.history.find(entry => entry.id === id))
        .filter(Boolean)
        .map(cloneForUndo);
      const snapshot = correctionSnapshot(day, originalEntries[0] || {});
      snapshot.priorityTask = cloneForUndo(task);
      const amount = -parseCoinAmount(originalEntries.reduce((total, entry) => total + historyCoinDelta(entry), 0));
      const undoData = recordDeletionCorrection({
        originalEntries,
        snapshot,
        amount,
        day,
        title: "重点事项纠错"
      });
      removeCoinHistoryByIds(ids);
      originalEntries.forEach(entry => applyHistoryRecordDeletion(entry, day));
      restorePriorityTask(day, null);
      refreshAfterDayRecordCorrection(day);
      showUndoToast(undoData, {
        icon: "checkmark.circle",
        lines: ["已删除记录", "已同步修正当天统计"],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "positive"
      });
    }

    async function deleteReviewDayRecord(dayKeyValue) {
      const day = normalizeReviewDateKey(dayKeyValue);
      const review = state.dailyReviews?.[day];
      if (!review) {
        showToast("找不到这条记录");
        return;
      }
      const confirmed = await askForConfirmation({
        title: "删除这条记录？",
        message: "这会同步修正当天统计和相关金币记录。",
        confirmText: "删除"
      });
      if (!confirmed) return;

      const rewardHistoryId = state.reviewRewards?.[day];
      const originalEntries = rewardHistoryId
        ? [state.history.find(entry => entry.id === rewardHistoryId)].filter(Boolean).map(cloneForUndo)
        : [];
      const snapshot = correctionSnapshot(day, originalEntries[0] || {});
      snapshot.review = cloneForUndo(review);
      snapshot.reviewReward = cloneForUndo(rewardHistoryId);
      const amount = -parseCoinAmount(originalEntries.reduce((total, entry) => total + historyCoinDelta(entry), 0));
      const undoData = recordDeletionCorrection({
        originalEntries,
        snapshot,
        amount,
        day,
        title: "每日复盘纠错"
      });
      if (rewardHistoryId) removeCoinHistoryByIds([rewardHistoryId]);
      delete state.dailyReviews[day];
      state.reviewRewards = state.reviewRewards && typeof state.reviewRewards === "object" ? state.reviewRewards : {};
      delete state.reviewRewards[day];
      refreshAfterDayRecordCorrection(day);
      showUndoToast(undoData, {
        icon: "checkmark.circle",
        lines: ["已删除记录", "已同步修正当天统计"],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: "positive"
      });
    }

    function deleteDayRecord(recordId) {
      const value = String(recordId || "");
      if (value.startsWith("priority:")) {
        deletePriorityDayRecord(value.slice("priority:".length));
        return;
      }
      if (value.startsWith("review:")) {
        deleteReviewDayRecord(value.slice("review:".length));
        return;
      }
      deleteHistoryDayRecord(value);
    }

    function deleteBadHabitRecord(historyId) {
      deleteDayRecord(historyId);
    }

    function updateStreakForCompletion(today) {
      if (state.lastCompletedDate === today) return;
      state.streak = state.lastCompletedDate === yesterdayKey() ? state.streak + 1 : 1;
      state.lastCompletedDate = today;
    }

    function triggerBadHabit(habitId, sourceEl = null) {
      const habit = state.badHabits.find(item => item.id === habitId);
      if (!habit) return;
      const amount = parseAmount(habit.penalty);
      if (!state.badHabits.some(item => item.id === habitId)) return;

      state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
      const coinEvent = recordCoinEvent({
        type: "bad_habit",
        amount: -amount,
        date: dateKey(),
        history: {
          habitId: habit.id,
          name: habit.name,
          coins: amount
        }
      });
      const historyId = coinEvent.historyId;
      saveState();
      updatePrimaryReadouts();
      showCoinFeedback(amount, "negative", sourceEl);
      scheduleRender(240);
      showUndoToast(
        {
          type: "bad_habit",
          historyId,
          amount
        },
        {
          icon: "minus.circle",
          message: "已扣除",
          undoLabel: "撤回",
          duration: 5000
        }
      );
    }

    function depositFund(rewardId, sourceEl = null, buttonEl = null) {
      const fund = state.rewards.find(item => item.id === rewardId);
      if (!fund) return;
      const totalCoins = fundTotalCoins(fund);
      const currentCoins = fundCurrentCoins(fund);
      const completionStateBeforeMigration = typeof fund.completedBeforePastCoinHistoryScaleMigration === "boolean"
        ? fund.completedBeforePastCoinHistoryScaleMigration
        : null;
      if (fundCompleted(fund)) {
        showInfoToast(["基金已完成", fund.name], 2200, "checkmark.circle");
        return;
      }

      const amountPerDeposit = fundAmountPerDeposit(fund);
      const amount = parseCoinAmount(Math.min(amountPerDeposit, totalCoins - currentCoins));
      if (amount <= 0) return;
      if (state.coins < amount) {
        showInfoToast([
          "金币不足",
          `还差 ${formatCoinAmount(amount - state.coins)} 金币`
        ], 2400);
        return;
      }

      const previousCoins = state.coins;
      const now = new Date().toISOString();
      const nextCoins = parseCoinAmount(currentCoins + amount);
      const completedNow = nextCoins >= totalCoins;
      const achievementId = completedNow ? createId("achievement") : null;
      state.achievements = Array.isArray(state.achievements) ? state.achievements : [];
      state.rewards = state.rewards.map(item => (
        item.id === rewardId
          ? {
              ...item,
              totalCoins,
              amountPerDeposit,
              currentCoins: nextCoins,
              completedBeforePastCoinHistoryScaleMigration: undefined,
              completedAt: completedNow ? now : item.completedAt || null,
              achievementId: completedNow ? achievementId : item.achievementId || null,
              updatedAt: now
            }
          : item
      ));
      if (completedNow) {
        state.achievements.unshift({
          id: achievementId,
          type: "fund_completed",
          rewardId,
          name: fund.name,
          totalCoins,
          completedAt: now,
          date: dateKey(new Date(now))
        });
      }
      state.totals.coinsSpent = parseCoinAmount((Number(state.totals.coinsSpent) || 0) + amount);
      const coinEvent = recordRewardCoinEvent({
        type: "fund_deposit",
        amount: -amount,
        date: dateKey(),
        timestamp: now,
        history: {
          rewardId,
          name: fund.name,
          amount,
          totalCoins,
          currentCoinsBefore: currentCoins,
          currentCoinsAfter: nextCoins,
          completionStateBeforeMigration,
          completed: completedNow,
          achievementId
        }
      });
      const historyId = coinEvent.historyId;
      saveState();
      const totals = summaryTotals();
      if (els.statSpent) els.statSpent.textContent = formatCoinAmount(totals.coinsSpent);
      if (els.statPenalty) els.statPenalty.textContent = formatCoinAmount(totals.coinsPenalty);
      if (sourceEl) {
        prepareActionCard(sourceEl);
        sourceEl.classList.remove("reward-redeemed");
        void sourceEl.offsetWidth;
        sourceEl.classList.add("reward-redeemed");
      }
      if (buttonEl) {
        buttonEl.classList.remove("reward-button-spend");
        void buttonEl.offsetWidth;
        buttonEl.classList.add("reward-button-spend");
      }
      animateCoinBalance(previousCoins, state.coins);
      showFundDepositFeedback(sourceEl);
      scheduleRender(840);
      showUndoToast({
        type: "fund_deposit",
        historyId,
        rewardId,
        amount,
        currentCoinsBefore: currentCoins,
        currentCoinsAfter: nextCoins,
        completionStateBeforeMigration,
        completed: completedNow,
        achievementId
      }, {
        icon: completedNow ? "checkmark.circle" : "plus.circle",
        lines: [
          `✓ 已注入 ${formatCoinAmount(amount)} 金币`,
          fund.name,
          `进度：${formatFundCoins(nextCoins)} / ${formatFundCoins(totalCoins)}`
        ],
        undoLabel: "撤回",
        duration: 5000,
        iconTone: completedNow ? "positive" : ""
      });
      if (completedNow && typeof openFundCelebrationDialog === "function") {
        window.setTimeout(() => {
          const liveFund = state.rewards.find(item => item.id === rewardId);
          const achievementExists = (Array.isArray(state.achievements) ? state.achievements : [])
            .some(item => item.id === achievementId);
          if (liveFund && fundCompleted(liveFund) && achievementExists) {
            openFundCelebrationDialog(fund.name);
          }
        }, 520);
      }
    }
    function showFundDepositFeedback(sourceEl = null) {
      const rect = sourceEl ? sourceEl.getBoundingClientRect() : els.rewardCoins.getBoundingClientRect();
      const message = document.createElement("span");
      message.className = "floating-reward-message";
      message.textContent = "已注入";
      message.style.left = `${rect.left + rect.width / 2}px`;
      message.style.top = `${rect.top + 12}px`;
      document.body.appendChild(message);
      message.addEventListener("animationend", () => message.remove(), { once: true });
    }

    function showCoinFeedback(amount, tone = "negative", sourceEl = null, options = {}) {
      const pulseClass = tone === "positive" ? "coin-pulse-positive" : "coin-pulse-negative";
      [els.homeCoins, els.badCoins, els.rewardCoins, els.statCoins].forEach(target => {
        if (!target) return;
        target.classList.remove("coin-pulse-positive", "coin-pulse-negative");
        void target.offsetWidth;
        target.classList.add(pulseClass);
      });

      if (sourceEl && options.flash !== false) {
        const flashClass = tone === "positive" ? "flash-green" : "flash-red";
        sourceEl.classList.remove("flash-green", "flash-red");
        void sourceEl.offsetWidth;
        sourceEl.classList.add(flashClass);
      }

      const rect = sourceEl ? sourceEl.getBoundingClientRect() : els.homeCoins.getBoundingClientRect();
      const delta = document.createElement("span");
      delta.className = `floating-delta ${tone}`;
      delta.textContent = `${tone === "positive" ? "+" : "-"}${formatCoinAmount(amount)}`;
      delta.style.left = `${rect.left + rect.width / 2}px`;
      delta.style.top = `${rect.top + 14}px`;
      document.body.appendChild(delta);
      delta.addEventListener("animationend", () => delta.remove(), { once: true });
    }

    function showTaskRewardToast({ earnedCoins, durationSeconds = 0, currentCoins, showDuration = false, undoData = null }) {
      const lines = [`获得 ${formatCoinAmount(earnedCoins)} 金币`];
      if (showDuration) lines.push(`用时 ${formatTaskDurationClock(durationSeconds)}`);
      lines.push(`当前金币 ${formatCoinAmount(currentCoins)}`);
      if (undoData) {
        showUndoToast(undoData, {
          icon: "checkmark.circle",
          lines,
          undoLabel: "撤回",
          duration: 5000,
          iconTone: "positive"
        });
        return;
      }

      clearPendingUndo(false);
      clearTimeout(showToast.timer);
      els.toast.textContent = "";
      const toastMessage = document.createElement("span");
      toastMessage.className = "toast-message toast-message-stacked";
      const iconEl = document.createElement("span");
      iconEl.className = "toast-icon action-icon positive";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.innerHTML = actionIcons["checkmark.circle"];
      toastMessage.append(iconEl);
      lines.forEach(line => {
        const lineEl = document.createElement("span");
        lineEl.className = "toast-line";
        lineEl.textContent = line;
        toastMessage.append(lineEl);
      });
      els.toast.append(toastMessage);
      els.toast.classList.remove("interactive");
      els.toast.classList.add("show");
      showToast.timer = setTimeout(() => {
        els.toast.classList.remove("show");
      }, 3600);
    }

    function showInfoToast(lines, duration = 2200, icon = "") {
      if (pendingUndo) return;
      clearPendingUndo(false);
      clearTimeout(showToast.timer);
      els.toast.textContent = "";
      const toastMessage = document.createElement("span");
      toastMessage.className = "toast-message toast-message-stacked";
      if (icon && actionIcons[icon]) {
        const iconEl = document.createElement("span");
        iconEl.className = "toast-icon action-icon positive";
        iconEl.setAttribute("aria-hidden", "true");
        iconEl.innerHTML = actionIcons[icon];
        toastMessage.append(iconEl);
      }
      lines.forEach(line => {
        const lineEl = document.createElement("span");
        lineEl.className = "toast-line";
        lineEl.textContent = line;
        toastMessage.append(lineEl);
      });
      els.toast.append(toastMessage);
      els.toast.classList.remove("interactive");
      els.toast.classList.add("show");
      showToast.timer = setTimeout(() => {
        els.toast.classList.remove("show");
      }, duration);
    }

    function clearPendingUndo(hideToast = false) {
      if (pendingUndo?.timer) {
        clearTimeout(pendingUndo.timer);
      }
      pendingUndo = null;
      els.toast.classList.remove("interactive");
      if (hideToast) {
        els.toast.classList.remove("show");
        els.toast.textContent = "";
      }
    }

    function showUndoToast(undoData, options = {}) {
      const {
        icon = "",
        message = "操作已执行",
        lines = null,
        undoLabel = "撤回",
        duration = 5000,
        iconTone = ""
      } = options;
      clearPendingUndo(false);
      clearTimeout(showToast.timer);
      pendingUndo = {
        ...undoData,
        timer: window.setTimeout(() => {
          clearPendingUndo(true);
        }, duration)
      };
      els.toast.textContent = "";
      const toastMessage = document.createElement("span");
      toastMessage.className = "toast-message";
      if (icon && actionIcons[icon]) {
        const iconEl = document.createElement("span");
        iconEl.className = `toast-icon action-icon${iconTone ? ` ${iconTone}` : ""}`;
        iconEl.setAttribute("aria-hidden", "true");
        iconEl.innerHTML = actionIcons[icon];
        toastMessage.append(iconEl);
      }
      const messageLines = Array.isArray(lines) && lines.length ? lines : [message];
      if (messageLines.length > 1) toastMessage.classList.add("toast-message-stacked");
      messageLines.forEach(line => {
        const messageEl = document.createElement("span");
        messageEl.className = "toast-line";
        messageEl.textContent = line;
        toastMessage.append(messageEl);
      });
      const separatorEl = document.createElement("span");
      separatorEl.setAttribute("aria-hidden", "true");
      separatorEl.textContent = "·";
      const undoButton = document.createElement("button");
      undoButton.type = "button";
      undoButton.dataset.undoAction = "";
      undoButton.className = "toast-undo-button";
      undoButton.textContent = undoLabel;
      els.toast.append(toastMessage, separatorEl, undoButton);
      els.toast.classList.add("interactive", "show");
    }

    function undoLastAction() {
      if (!pendingUndo) return;
      const undo = pendingUndo;
      clearPendingUndo(true);
      clearTimeout(scheduleRender.timer);

      const historyIds = new Set(undo.historyIds || (undo.historyId ? [undo.historyId] : []));
      const hasHistory = Array.from(historyIds).some(id => state.history.some(item => item.id === id));
      if (!hasHistory) {
        showToast("无法撤回");
        return;
      }

      const undoHistoryById = new Map(
        state.history
          .filter(item => historyIds.has(item.id))
          .map(item => [item.id, item])
      );
      removeCoinHistoryByIds(historyIds);
      if (undo.type === "task_failed" || undo.type === "task_auto_failed" || undo.type === "automatic_failures") {
        const entries = undo.taskEntries || undo.entries || (undo.taskId ? [undo] : []);
        let restoredAmount = 0;
        entries.forEach(entry => {
          removeDayValue("taskResults", entry.date, entry.taskId);
          restoreTaskState(entry.taskId, entry.previousTask);
          restoredAmount = parseCoinAmount(restoredAmount + entry.amount);
        });
        undoCoinEvent({ coinDelta: -restoredAmount, removeHistory: false });
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - restoredAmount));
        if (undo.type === "automatic_failures" && undo.bonusEntries?.length) {
          const bonusAmount = undo.bonusEntries.reduce((total, entry) => parseCoinAmount(total + (entry.amount || 0)), 0);
          undoCoinEvent({ coinDelta: bonusAmount, removeHistory: false });
          state.noBadHabitBonuses = state.noBadHabitBonuses && typeof state.noBadHabitBonuses === "object" ? state.noBadHabitBonuses : {};
          undo.bonusEntries.forEach(entry => {
            state.noBadHabitBonuses[entry.date] = {
              status: "dismissed",
              dismissedAt: new Date().toISOString()
            };
          });
        }
      }
      if (undo.type === "habit_auto_failed" || undo.type === "automatic_failures") {
        const entries = undo.habitEntries || undo.entries || [];
        const restoredAmount = entries.reduce((total, entry) => parseCoinAmount(total + entry.amount), 0);
        undoCoinEvent({ coinDelta: -restoredAmount, removeHistory: false });
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - restoredAmount));
      }
      if (undo.type === "priority_task_penalty" || undo.type === "automatic_failures") {
        const entries = undo.priorityEntries || [];
        const restoredAmount = entries.reduce((total, entry) => {
          const historyEntry = undoHistoryById.get(entry.historyId);
          const actualAmount = historyEntry
            ? Math.abs(historyCoinDelta(historyEntry))
            : parseCoinAmount(entry.amount);
          return parseCoinAmount(total + actualAmount);
        }, 0);
        entries.forEach(entry => {
          restorePriorityTask(entry.date, entry.previousTask);
        });
        undoCoinEvent({ coinDelta: -restoredAmount, removeHistory: false });
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - restoredAmount));

        if (undo.type === "priority_task_penalty" && undo.bonusEntries?.length) {
          const bonusAmount = undo.bonusEntries.reduce((total, entry) => parseCoinAmount(total + (entry.amount || 0)), 0);
          undoCoinEvent({ coinDelta: bonusAmount, removeHistory: false });
          state.noBadHabitBonuses = state.noBadHabitBonuses && typeof state.noBadHabitBonuses === "object" ? state.noBadHabitBonuses : {};
          undo.bonusEntries.forEach(entry => {
            state.noBadHabitBonuses[entry.date] = {
              status: "dismissed",
              dismissedAt: new Date().toISOString()
            };
          });
        }
      }
      if (undo.type === "task_completed") {
        restoreTaskState(undo.taskId, undo.previousTask);
        restoreTaskProgress(undo.date, undo.taskId, undo.previousProgress);
        undoCoinEvent({ coinDelta: undo.amount, removeHistory: false });
        state.totals.completedTasks = Math.max(0, (Number(state.totals.completedTasks) || 0) - 1);
        state.totals.taskDurationSeconds = Math.max(0, (Number(state.totals.taskDurationSeconds) || 0) - (Number(undo.durationSeconds) || 0));
        state.totals.earnedTaskCoins = Math.max(0, parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) - undo.amount));
      }
      if (undo.type === "habit_completed") {
        restoreHabitProgress(undo.date, undo.habitId, undo.previousProgress);
        undoCoinEvent({ coinDelta: undo.amount, removeHistory: false });
      }
      if (undo.type === "priority_task_reward") {
        restorePriorityTask(undo.date, undo.previousTask);
        const historyEntry = undoHistoryById.get(undo.historyId);
        const actualAmount = historyEntry
          ? Math.abs(historyCoinDelta(historyEntry))
          : parseCoinAmount(undo.amount);
        undoCoinEvent({ coinDelta: actualAmount, removeHistory: false });
      }
      if (undo.type === "bad_habit") {
        undoCoinEvent({ coinDelta: -undo.amount, removeHistory: false });
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - undo.amount));
      }
      if (undo.type === "no_bad_habit_bonus") {
        const entries = undo.bonusEntries || (undo.date ? [undo] : []);
        const restoredAmount = entries.reduce((total, entry) => parseCoinAmount(total + (entry.amount || 0)), 0);
        undoCoinEvent({ coinDelta: restoredAmount, removeHistory: false });
        state.noBadHabitBonuses = state.noBadHabitBonuses && typeof state.noBadHabitBonuses === "object" ? state.noBadHabitBonuses : {};
        entries.forEach(entry => {
          state.noBadHabitBonuses[entry.date] = {
            status: "dismissed",
            dismissedAt: new Date().toISOString()
          };
        });
      }
      if (undo.type === "reward_redeemed") {
        undoCoinEvent({ coinDelta: -undo.amount, removeHistory: false });
        state.totals.coinsSpent = Math.max(0, parseCoinAmount((Number(state.totals.coinsSpent) || 0) - undo.amount));
      }
      if (undo.type === "fund_deposit") {
        undoCoinEvent({ coinDelta: -undo.amount, removeHistory: false });
        state.totals.coinsSpent = Math.max(0, parseCoinAmount((Number(state.totals.coinsSpent) || 0) - undo.amount));
        state.rewards = state.rewards.map(fund => (
          fund.id === undo.rewardId
            ? {
                ...fund,
                currentCoins: fundCurrentCoins({ ...fund, currentCoins: undo.currentCoinsBefore }),
                completedBeforePastCoinHistoryScaleMigration: typeof undo.completionStateBeforeMigration === "boolean"
                  ? undo.completionStateBeforeMigration
                  : undefined,
                completedAt: undo.completed ? null : fund.completedAt || null,
                achievementId: undo.completed ? null : fund.achievementId || null,
                updatedAt: new Date().toISOString()
              }
            : fund
        ));
        if (undo.achievementId) {
          state.achievements = (Array.isArray(state.achievements) ? state.achievements : [])
            .filter(item => item.id !== undo.achievementId);
        }
        if (undo.completed && typeof closeFundCelebrationDialog === "function") {
          closeFundCelebrationDialog();
        }
      }
      if (undo.type === "day_record_delete") {
        undoCoinEvent({ coinDelta: undo.correctionDelta, removeHistory: false });
        insertHistoryEntries(undo.originalEntries || []);
        restoreCorrectionSnapshot(undo.snapshot, (undo.originalEntries || [])[0] || { date: undo.date });
      }

      saveState();
      render();
      if (undo.date && !els.dayDetailBackdrop.classList.contains("hidden")) {
        if (dayHasEditableRecords(undo.date)) {
          els.dayDetailContent.innerHTML = buildDayDetailHtml(undo.date);
        } else {
          closeDayDetail();
        }
      }
      showToast("已撤回");
    }
