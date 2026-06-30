    const PHONE_TIMER_NAME = "玩手机";
    const PHONE_TIMER_RATE = 2;

    function ensurePhoneTimer() {
      state.phoneTimer = state.phoneTimer && typeof state.phoneTimer === "object"
        ? state.phoneTimer
        : { status: "idle", startTime: null, updatedAt: null };
      return state.phoneTimer;
    }

    function phoneTimerStatus() {
      const timer = ensurePhoneTimer();
      return timer.status === "running" && timer.startTime ? "running" : "idle";
    }

    function phoneTimerStartedAtLabel() {
      const timer = ensurePhoneTimer();
      if (!timer.startTime) return "";
      const date = new Date(timer.startTime);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(date);
    }

    function phoneTimerDeductionPayload(startTime, endTime = new Date()) {
      const payload = taskDurationPayload(startTime, endTime, PHONE_TIMER_RATE);
      return {
        durationSeconds: payload.durationSeconds,
        durationMinutes: payload.durationMinutes,
        deductedCoins: payload.earnedCoins
      };
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
        if (item.type === "task_failed" || item.type === "habit_failed") {
          totals.coinsPenalty += parseCoinAmount(item.coins);
        }
        if (item.type === "task_missed" || item.type === "bad_habit") {
          totals.coinsPenalty += parseAmount(item.coins);
        }
        if (item.type === "phone_timer") {
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
      if (els.statFocusDuration) els.statFocusDuration.textContent = formatFocusDuration(totals.taskDurationSeconds);
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
      state.coins = parseCoinAmount(state.coins + earnedCoins);
      state.totals.completedTasks = (Number(state.totals.completedTasks) || 0) + 1;
      state.totals.taskDurationSeconds = (Number(state.totals.taskDurationSeconds) || 0) + durationSeconds;
      state.totals.earnedTaskCoins = parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) + earnedCoins);
      updateStreakForCompletion(today);
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "task_completed",
        taskId: task.id,
        name: task.name,
        coins: earnedCoins,
        earnedCoins,
        durationMinutes,
        durationSeconds,
        startTime: task.startTime,
        endTime,
        date: today,
        timestamp: new Date().toISOString()
      });
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
      state.coins = parseCoinAmount(state.coins + earnedCoins);
      state.totals.completedTasks = (Number(state.totals.completedTasks) || 0) + 1;
      state.totals.earnedTaskCoins = parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) + earnedCoins);
      updateStreakForCompletion(today);
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "task_completed",
        taskId: task.id,
        name: task.name,
        coins: earnedCoins,
        earnedCoins,
        durationMinutes: 0,
        durationSeconds: 0,
        startTime: null,
        endTime: completedAt,
        date: today,
        timestamp: completedAt
      });
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
    }

    function completeHabit(habitId, sourceEl = null) {
      const habit = state.habits.find(item => item.id === habitId);
      if (!habit || habitCompletedToday(habitId)) return;

      const today = dateKey();
      const amount = parseAmount(habit.coins);
      const previousProgress = habitProgressSnapshot(today, habit.id);
      state.habitCompletions[today] = state.habitCompletions[today] || {};
      state.habitCompletions[today][habitId] = true;
      state.coins = parseCoinAmount(state.coins + amount);
      updateStreakForCompletion(today);
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "habit_completed",
        habitId: habit.id,
        name: habit.name,
        coins: amount,
        date: today,
        timestamp: new Date().toISOString()
      });
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
      state.coins = parseCoinAmount(state.coins - amount);
      state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "task_failed",
        taskId: task.id,
        name: task.name,
        coins: amount,
        date: today,
        timestamp: new Date().toISOString()
      });
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
        const historyId = createId("history");
        ensureDayRecord("habitFailures", day)[habit.id] = historyId;
        state.coins = parseCoinAmount(state.coins - amount);
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        state.history.unshift({
          id: historyId,
          type: "habit_failed",
          habitId: habit.id,
          name: habit.name,
          coins: amount,
          date: day,
          reason: "habit_missed",
          timestamp: new Date().toISOString()
        });
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
        const historyId = createId("history");
        const previousTask = taskPreviousState(task);

        ensureDayRecord("taskAutoFailures", today)[task.id] = historyId;
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
        state.coins = parseCoinAmount(state.coins - amount);
        state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
        state.history.unshift({
          id: historyId,
          type: "task_failed",
          taskId: task.id,
          name: task.name,
          coins: amount,
          date: today,
          reason: "timeout",
          timestamp: failedAt
        });
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

    function runAutomaticChecks(options = {}) {
      const { showToast: shouldShowToast = true } = options;
      const habitResult = settleMissedHabits();
      const taskResult = settleTimedTaskTimeouts();
      const changed = habitResult.count > 0 || taskResult.count > 0;
      if (!changed) return false;

      saveState();
      updatePrimaryReadouts();

      if (shouldShowToast) {
        const historyIds = [
          ...taskResult.entries.map(entry => entry.historyId),
          ...habitResult.entries.map(entry => entry.historyId)
        ];
        const totalPenalty = parseCoinAmount(taskResult.totalPenalty + habitResult.totalPenalty);
        const reasons = [
          taskResult.count > 0 ? "任务超时未完成" : "",
          habitResult.count > 0 ? "习惯未完成" : ""
        ].filter(Boolean).join(" / ");

        showUndoToast({
          type: "automatic_failures",
          historyIds,
          taskEntries: taskResult.entries,
          habitEntries: habitResult.entries,
          amount: totalPenalty
        }, {
          icon: "xmark.circle",
          lines: [
            `已自动扣除 ${formatCoinAmount(totalPenalty)} 金币`,
            `原因：${reasons}`,
            `当前金币 ${formatCoinAmount(state.coins)}`
          ],
          undoLabel: "撤回",
          duration: 5000
        });
      }

      return true;
    }

    function startPhoneTimer() {
      if (phoneTimerStatus() === "running") return;
      const startedAt = new Date().toISOString();
      state.phoneTimer = {
        ...ensurePhoneTimer(),
        status: "running",
        startTime: startedAt,
        updatedAt: startedAt
      };
      saveState();
      render();
    }

    function stopPhoneTimer(sourceEl = null) {
      const timer = ensurePhoneTimer();
      if (phoneTimerStatus() !== "running") return;

      const previousTimer = { ...timer };
      const endedAt = new Date().toISOString();
      const { durationSeconds, durationMinutes, deductedCoins } = phoneTimerDeductionPayload(timer.startTime, endedAt);
      const amount = parseCoinAmount(deductedCoins);
      const historyId = createId("history");

      state.phoneTimer = {
        status: "idle",
        startTime: null,
        updatedAt: endedAt,
        lastStartTime: timer.startTime,
        lastEndTime: endedAt,
        lastDurationSeconds: durationSeconds,
        lastDeductedCoins: amount
      };
      state.coins = parseCoinAmount(state.coins - amount);
      state.totals.coinsPenalty = parseCoinAmount((Number(state.totals.coinsPenalty) || 0) + amount);
      state.history.unshift({
        id: historyId,
        type: "phone_timer",
        name: PHONE_TIMER_NAME,
        coins: amount,
        durationMinutes,
        durationSeconds,
        startTime: timer.startTime,
        endTime: endedAt,
        date: dateKey(),
        timestamp: endedAt
      });

      saveState();
      updatePrimaryReadouts();
      prepareActionCard(sourceEl);
      if (sourceEl) sourceEl.classList.add("task-exit-penalty");
      showCoinFeedback(amount, "negative", sourceEl, { flash: false });
      scheduleRender(sourceEl ? 380 : 0);
      showUndoToast({
        type: "phone_timer",
        historyId,
        amount,
        previousTimer
      }, {
        icon: "minus.circle",
        lines: [
          `⊗ 扣除 ${formatCoinAmount(amount)} 金币`,
          `${PHONE_TIMER_NAME} ${formatTaskDurationClock(durationSeconds)}`,
          `当前金币 ${formatCoinAmount(state.coins)}`
        ],
        undoLabel: "撤回",
        duration: 5000
      });
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

      state.coins -= amount;
      state.totals.coinsPenalty += amount;
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "bad_habit",
        habitId: habit.id,
        name: habit.name,
        coins: amount,
        date: dateKey(),
        timestamp: new Date().toISOString()
      });
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

    async function redeemReward(rewardId, sourceEl = null, buttonEl = null) {
      const reward = state.rewards.find(item => item.id === rewardId);
      if (!reward) return;
      const amount = parseAmount(reward.cost);
      if (state.coins < amount) {
        showToast("金币不足");
        return;
      }
      const confirmed = await askForConfirmation({
        title: "确认兑换奖励",
        message: `将消耗 ${formatNumber(amount)} 金币。确认兑换「${reward.name}」吗？`,
        confirmText: "确认"
      });
      if (!confirmed) return;
      if (!state.rewards.some(item => item.id === rewardId)) return;
      if (state.coins < amount) {
        showToast("金币不足");
        return;
      }

      const previousCoins = state.coins;
      state.coins -= amount;
      state.totals.coinsSpent += amount;
      const historyId = createId("history");
      state.history.unshift({
        id: historyId,
        type: "reward_redeemed",
        rewardId: reward.id,
        name: reward.name,
        cost: amount,
        date: dateKey(),
        timestamp: new Date().toISOString()
      });
      saveState();
      const totals = summaryTotals();
      if (els.statSpent) els.statSpent.textContent = formatNumber(totals.coinsSpent);
      if (els.statPenalty) els.statPenalty.textContent = formatNumber(totals.coinsPenalty);
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
      showRewardRedeemedFeedback(sourceEl);
      scheduleRender(840);
      showUndoToast({
        type: "reward_redeemed",
        historyId,
        amount
      });
    }
    function showRewardRedeemedFeedback(sourceEl = null) {
      const rect = sourceEl ? sourceEl.getBoundingClientRect() : els.rewardCoins.getBoundingClientRect();
      const message = document.createElement("span");
      message.className = "floating-reward-message";
      message.textContent = "Reward redeemed";
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

      state.history = state.history.filter(item => !historyIds.has(item.id));
      if (undo.type === "task_failed" || undo.type === "task_auto_failed" || undo.type === "automatic_failures") {
        const entries = undo.taskEntries || undo.entries || (undo.taskId ? [undo] : []);
        let restoredAmount = 0;
        entries.forEach(entry => {
          removeDayValue("taskResults", entry.date, entry.taskId);
          restoreTaskState(entry.taskId, entry.previousTask);
          restoredAmount = parseCoinAmount(restoredAmount + entry.amount);
        });
        state.coins = parseCoinAmount(state.coins + restoredAmount);
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - restoredAmount));
      }
      if (undo.type === "habit_auto_failed" || undo.type === "automatic_failures") {
        const entries = undo.habitEntries || undo.entries || [];
        const restoredAmount = entries.reduce((total, entry) => parseCoinAmount(total + entry.amount), 0);
        state.coins = parseCoinAmount(state.coins + restoredAmount);
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - restoredAmount));
      }
      if (undo.type === "task_completed") {
        restoreTaskState(undo.taskId, undo.previousTask);
        restoreTaskProgress(undo.date, undo.taskId, undo.previousProgress);
        state.coins = parseCoinAmount(state.coins - undo.amount);
        state.totals.completedTasks = Math.max(0, (Number(state.totals.completedTasks) || 0) - 1);
        state.totals.taskDurationSeconds = Math.max(0, (Number(state.totals.taskDurationSeconds) || 0) - (Number(undo.durationSeconds) || 0));
        state.totals.earnedTaskCoins = Math.max(0, parseCoinAmount((Number(state.totals.earnedTaskCoins) || 0) - undo.amount));
      }
      if (undo.type === "habit_completed") {
        restoreHabitProgress(undo.date, undo.habitId, undo.previousProgress);
        state.coins = parseCoinAmount(state.coins - undo.amount);
      }
      if (undo.type === "bad_habit") {
        state.coins = parseCoinAmount(state.coins + undo.amount);
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - undo.amount));
      }
      if (undo.type === "phone_timer") {
        state.coins = parseCoinAmount(state.coins + undo.amount);
        state.totals.coinsPenalty = Math.max(0, parseCoinAmount((Number(state.totals.coinsPenalty) || 0) - undo.amount));
        state.phoneTimer = undo.previousTimer || { status: "idle", startTime: null, updatedAt: new Date().toISOString() };
      }
      if (undo.type === "reward_redeemed") {
        state.coins = parseCoinAmount(state.coins + undo.amount);
        state.totals.coinsSpent = Math.max(0, parseCoinAmount((Number(state.totals.coinsSpent) || 0) - undo.amount));
      }
      if (undo.type === "review_reward") {
        state.coins = parseCoinAmount(state.coins - undo.amount);
        state.reviewRewards = state.reviewRewards && typeof state.reviewRewards === "object" ? state.reviewRewards : {};
        delete state.reviewRewards[undo.date];
        if (undo.hadPreviousReview) {
          state.dailyReviews[undo.date] = undo.previousReview || {};
        } else if (state.dailyReviews?.[undo.date]) {
          delete state.dailyReviews[undo.date];
        }
      }

      saveState();
      render();
      showToast("已撤回");
    }
